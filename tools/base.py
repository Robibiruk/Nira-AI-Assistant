"""
Tool contract.

Every JARVIS capability is a ``Tool`` subclass with a name, a description,
a JSON-schema description of its parameters, and a ``run`` method. The
``schema()`` output is what gets sent to OpenRouter for native tool calling,
so the description text is what the model uses to decide *when* to call it.
"""
from __future__ import annotations

from abc import ABC, abstractmethod


class Tool(ABC):
    name: str = ""
    description: str = ""
    parameters: dict = {}  # JSON-schema "properties"
    required: list[str] = []

    def schema(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": self.parameters,
                    "required": self.required,
                },
            },
        }

    @abstractmethod
    def run(self, **kwargs) -> str:
        """Execute the tool and return a string the model can read back."""
