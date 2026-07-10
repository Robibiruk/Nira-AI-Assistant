"""File tools: read, write, and list files on the host."""
from __future__ import annotations

from pathlib import Path

from .base import Tool


class ReadFileTool(Tool):
    name = "read_file"
    description = "Read and return the text contents of a file at an absolute or relative path."
    parameters = {
        "path": {"type": "string", "description": "Path to the file to read."}
    }
    required = ["path"]

    def run(self, path: str) -> str:
        p = Path(path)
        if not p.exists():
            return f"File not found: {path}"
        return p.read_text(encoding="utf-8", errors="replace")


class WriteFileTool(Tool):
    name = "write_file"
    description = "Write text to a file, creating or overwriting it. Parent directories are created."
    parameters = {
        "path": {"type": "string", "description": "Path to the file to write."},
        "content": {"type": "string", "description": "Text content to write."},
    }
    required = ["path", "content"]

    def run(self, path: str, content: str) -> str:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return f"Wrote {len(content)} characters to {path}"


class ListDirTool(Tool):
    name = "list_directory"
    description = "List files and folders inside a directory."
    parameters = {
        "path": {
            "type": "string",
            "description": "Directory path. Defaults to the current directory.",
        }
    }
    required: list[str] = []

    def run(self, path: str = ".") -> str:
        p = Path(path)
        if not p.exists():
            return f"Directory not found: {path}"
        items = [
            f"{'DIR ' if item.is_dir() else 'FILE'} {item.name}"
            for item in sorted(p.iterdir())
        ]
        return "\n".join(items) if items else "(empty)"


file_tools = [ReadFileTool(), WriteFileTool(), ListDirTool()]
