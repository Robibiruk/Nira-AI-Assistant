"""
Terminal tool: run a shell command on the host.

SECURITY NOTE: this executes arbitrary commands on the user's machine. That is
intentional for a local personal assistant, but it is powerful — only enable
this tool for trusted, local use.
"""
from __future__ import annotations

import subprocess

from .base import Tool


class TerminalTool(Tool):
    name = "run_terminal_command"
    description = (
        "Run a shell/terminal command on the user's machine and return its "
        "stdout/stderr. Use for system tasks the user asks you to perform "
        "(list processes, check disk space, run a script, etc.)."
    )
    parameters = {
        "command": {
            "type": "string",
            "description": "The shell command to execute.",
        }
    }
    required = ["command"]

    def run(self, command: str) -> str:
        try:
            proc = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30,
            )
        except subprocess.TimeoutExpired:
            return "Command timed out after 30 seconds."
        out = (proc.stdout or "") + (proc.stderr or "")
        return out.strip() or f"(exit code {proc.returncode}, no output)"


terminal_tool = TerminalTool()
