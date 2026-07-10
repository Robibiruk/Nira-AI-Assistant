"""
Planner (intended for V2+).

For the MVP, the model decides tool usage directly through OpenRouter's
native tool calling, so no separate planning step is needed. This module is
the planned home for multi-step planning: decomposing a complex request into
an ordered sequence of tool calls, executing them, and synthesizing a final
answer. For now it is a single-step pass-through.
"""


def plan(user_input: str, history: list[dict]) -> list[str]:
    """Return an ordered list of steps for a request.

    MVP: one step per request (the model handles tool selection itself).
    """
    return [user_input]
