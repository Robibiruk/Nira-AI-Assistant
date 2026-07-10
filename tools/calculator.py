"""Calculator tool: exact arithmetic + symbolic math.

The LLM should NOT be used for arithmetic. This module evaluates
mathematical expressions in pure Python for perfect accuracy.

Supports:
  * Basic arithmetic: 2847 * 984 + 293**2
  * Functions: sqrt, sin, cos, tan, log, exp, ...
  * Constants: pi, e, tau
  * Symbolic: solve equations via SymPy (x**2 + 2*x + 1)
  * Matrix/linear algebra

Security: uses a restricted namespace; no __builtins__, no I/O,
no network, no imports.
"""
from __future__ import annotations

import ast
import math

from .base import Tool

# Safe builtins subset — no I/O, no network, no reflection.
_SAFE_GLOBALS: dict = {
    "True": True,
    "False": False,
    "None": None,
    "abs": abs,
    "min": min,
    "max": max,
    "sum": sum,
    "round": round,
    "pow": pow,
    "divmod": divmod,
    # math module
    "math": math,
    # constants
    "pi": math.pi,
    "e": math.e,
    "tau": math.tau,
    "inf": math.inf,
    "nan": math.nan,
}

# Known-safe math functions that we expose at top level for convenience.
for _name in dir(math):
    if not _name.startswith("_"):
        _SAFE_GLOBALS[_name] = getattr(math, _name)

# SymPy available? Only import if installed; keep calculator working without it.
try:
    import sympy

    _SAFE_GLOBALS["sympy"] = sympy
    _SAFE_GLOBALS["Symbol"] = sympy.Symbol
    _SAFE_GLOBALS["solve"] = sympy.solve
    _SAFE_GLOBALS["diff"] = sympy.diff
    _SAFE_GLOBALS["integrate"] = sympy.integrate
    _SAFE_GLOBALS["Matrix"] = sympy.Matrix
    _SAFE_GLOBALS["simplify"] = sympy.simplify
    _SAFE_GLOBALS["expand"] = sympy.expand
    _SAFE_GLOBALS["factor"] = sympy.factor
    _SYMPY = True
except ImportError:
    _SYMPY = False


def _check_expr(expr: str) -> None:
    """Reject any expression containing disallowed patterns."""
    bad = {
        "import",
        "from",
        "__",
        "lambda",
        "exec",
        "eval",
        "compile",
        "open",
        "input",
        "help",
        "dir",
        "getattr",
        "setattr",
        "globals",
        "locals",
        "vars",
        "breakpoint",
        r"os\.",
        r"sys\.",
        "subprocess",
        "requests",
        "httpx",
        "socket",
        "pickle",
        "marshal",
        "ctypes",
    }
    lowered = expr.lower()
    for keyword in bad:
        if keyword in lowered:
            raise ValueError(f"Forbidden pattern: {keyword}")


def _eval_numeric(expr: str) -> str:
    """Evaluate a numeric expression safely."""
    _check_expr(expr)
    try:
        node = ast.parse(expr, mode="eval")
    except SyntaxError as exc:
        raise ValueError(f"Syntax error: {exc}")

    # Whitelist of allowed AST node types (Python 3.8+ compatible).
    allowed = (
        ast.Expression,
        ast.BinOp,
        ast.UnaryOp,
        ast.Constant,
        ast.Name,
        ast.Call,
        ast.List,
        ast.Tuple,
        ast.Dict,
        ast.Index,
        ast.Slice,
        ast.Attribute,
        ast.Subscript,
        ast.Expr,
    )

    def check(node):
        if not isinstance(node, allowed):
            raise ValueError(f"Disallowed AST node: {type(node).__name__}")
        if isinstance(node, ast.Name):
            if node.id not in _SAFE_GLOBALS:
                raise ValueError(f"Unknown name: {node.id}")
        if isinstance(node, ast.Attribute):
            if node.attr.startswith("_"):
                raise ValueError(f"Private attribute: {node.attr}")
        if isinstance(node, ast.Call):
            check(node.func)
        for child in ast.iter_child_nodes(node):
            check(child)

    check(node)
    try:
        result = eval(compile(node, "<expr>", "eval"), {"__builtins__": {}}, _SAFE_GLOBALS)
    except Exception as exc:
        raise ValueError(f"Evaluation error: {exc}")

    # Format the result nicely.
    if isinstance(result, (list, tuple)):
        return str([_format(v) for v in result])
    return str(_format(result))


def _format(val) -> str | float | int:
    """Format a numeric result cleanly."""
    if isinstance(val, float):
        if val.is_integer():
            return int(val)
        # Round very small floats to integers if they look like noise.
        if abs(val - round(val)) < 1e-10:
            return round(val)
        return val
    if isinstance(val, complex):
        return str(val)
    return val


def _eval_sympy(expr: str) -> str:
    """Evaluate a symbolic expression using SymPy."""
    if not _SYMPY:
        raise ValueError("SymPy not installed; install with: pip install sympy")
    _check_expr(expr)
    try:
        locals_out: dict = {}
        result = eval(expr, {"__builtins__": {}}, {**_SAFE_GLOBALS, "locals": locals_out})
        if result is None:
            return "No result."
        return str(result)
    except Exception as exc:
        raise ValueError(f"Symbolic evaluation error: {exc}")


class CalculatorTool(Tool):
    name = "calculate"
    description = (
        "Perform exact arithmetic, algebra, calculus, or symbolic math. "
        "Use this when the user asks for a numerical or mathematical result. "
        "Never let the AI model do arithmetic itself."
    )
    parameters = {
        "expression": {
            "type": "string",
            "description": "The mathematical expression or equation to evaluate, e.g. '2847 * 984 + 293**2' or 'solve(x**2 + 2*x + 1, x)'.",
        }
    }
    required = ["expression"]

    def run(self, expression: str) -> str:
        expr = expression.strip()
        if not expr:
            return "Empty expression."

        lowered = expr.lower()
        # Detect symbolic intent.
        symbolic_keywords = {
            "solve",
            "diff",
            "integrate",
            "simplify",
            "expand",
            "factor",
            "matrix",
            "symbol",
            "sympy",
        }
        if any(kw in lowered for kw in symbolic_keywords):
            try:
                return _eval_sympy(expr)
            except ValueError as e:
                return f"Symbolic error: {e}"

        # Numeric evaluation.
        try:
            return _eval_numeric(expr)
        except ValueError as e:
            # Maybe it's symbolic after all.
            if _SYMPY:
                try:
                    return _eval_sympy(expr)
                except ValueError:
                    pass
            return f"Calculation error: {e}"


calculator_tool = CalculatorTool()
