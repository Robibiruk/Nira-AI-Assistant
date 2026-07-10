"""Windows system enumeration: list open windows and running applications.

Uses pywin32 (win32gui / win32process) for window enumeration and psutil
for process/tab information. Windows-only; returns empty lists on other
platforms.
"""
from __future__ import annotations

import sys

from .base import Tool

if sys.platform == "win32":
    try:
        import win32gui
        import win32process
        import win32con
        import psutil

        _WIN32_AVAILABLE = True
    except ImportError:
        _WIN32_AVAILABLE = False
else:
    _WIN32_AVAILABLE = False


def _get_window_title(hwnd: int) -> str:
    try:
        return win32gui.GetWindowText(hwnd)
    except Exception:
        return ""


def _get_class_name(hwnd: int) -> str:
    try:
        return win32gui.GetClassName(hwnd)
    except Exception:
        return ""


def _is_window_visible(hwnd: int) -> bool:
    try:
        return win32gui.IsWindowVisible(hwnd)
    except Exception:
        return False


def _is_alt_tab_window(hwnd: int) -> bool:
    """Filter to windows that appear in Alt+Tab (normal top-level windows)."""
    if not _is_window_visible(hwnd):
        return False
    title = _get_window_title(hwnd)
    if not title:
        return False
    cls = _get_class_name(hwnd)
    # Exclude known non-Alt+Tab windows.
    exclude = {"Button", "Static", "Edit", "ComboBox", "SysListView32"}
    if cls in exclude:
        return False
    # Exclude very short titles (often system internals).
    if len(title.strip()) < 2:
        return False
    return True


def list_windows() -> list[dict]:
    """Return a list of open windows with titles and optional process info."""
    if not _WIN32_AVAILABLE:
        return []

    windows = []

    def enum_callback(hwnd: int, _):
        if _is_alt_tab_window(hwnd):
            title = _get_window_title(hwnd)
            cls = _get_class_name(hwnd)
            try:
                _, pid = win32process.GetWindowThreadProcessId(hwnd)
                p = psutil.Process(pid)
                exe = p.name()
            except Exception:
                exe = ""
            windows.append({"title": title, "class": cls, "exe": exe})

    win32gui.EnumWindows(enum_callback, None)
    # Sort by title for stable ordering.
    windows.sort(key=lambda w: w["title"].lower())
    return windows


def list_open_apps() -> list[dict]:
    """Return a list of running applications (unique by exe name)."""
    if not _WIN32_AVAILABLE:
        return []

    seen: set = set()
    apps = []
    for proc in psutil.process_iter(["name", "pid"]):
        try:
            name = proc.info["name"] or ""
            if name and name not in seen:
                seen.add(name)
                apps.append({"name": name, "pid": proc.info["pid"]})
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    apps.sort(key=lambda a: a["name"].lower())
    return apps


def list_chrome_tabs() -> list[dict]:
    """List open tabs in Chrome/Edge/Chromium browsers.

    Uses psutil to find browser processes and win32gui to enumerate
    individual tab windows. Returns a flat list of tab titles + URLs
    where detectable.
    """
    if not _WIN32_AVAILABLE:
        return []

    tabs = []
    browser_exes = {"chrome", "msedge", "brave", "opera", "chromium"}

    for proc in psutil.process_iter(["name", "cmdline"]):
        try:
            name = (proc.info["name"] or "").lower()
            if name not in browser_exes:
                continue
            for hwnd in _find_child_windows(proc.info["pid"]):
                title = _get_window_title(hwnd)
                if title and " - " in title:
                    # Often: "Page Title - Browser Name"
                    page = title.split(" - ", 1)[0].strip()
                    if page:
                        tabs.append({"title": page, "source": name})
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    return tabs


def _find_child_windows(pid: int) -> list[int]:
    """Find all top-level windows belonging to a process."""
    hwnds = []

    def enum_callback(hwnd: int, _):
        try:
            _, wpid = win32process.GetWindowThreadProcessId(hwnd)
            if wpid == pid:
                hwnds.append(hwnd)
        except Exception:
            pass

    win32gui.EnumWindows(enum_callback, None)
    return hwnds


class ListWindowsTool(Tool):
    name = "list_windows"
    description = (
        "List all open windows on the user's Windows desktop. "
        "Useful when the user asks what windows are open or wants to "
        "focus/close a specific window."
    )
    parameters: dict = {}
    required: list[str] = []

    def run(self) -> str:
        wins = list_windows()
        if not wins:
            return "No open windows found (or not supported on this platform)."
        lines = []
        for w in wins:
            exe = w.get("exe", "")
            title = w.get("title", "")
            if exe:
                lines.append(f"[{exe}] {title}")
            else:
                lines.append(title)
        return "Open windows:\n" + "\n".join(lines)


class ListAppsTool(Tool):
    name = "list_apps"
    description = (
        "List all running applications. Returns executable names and PIDs. "
        "Useful when the user asks what programs are running."
    )
    parameters: dict = {}
    required: list[str] = []

    def run(self) -> str:
        apps = list_open_apps()
        if not apps:
            return "No running applications found (or not supported on this platform)."
        lines = [f"{a['name']} (PID: {a['pid']})" for a in apps]
        return "Running apps:\n" + "\n".join(lines)


class ListTabsTool(Tool):
    name = "list_tabs"
    description = (
        "List open browser tabs (Chrome, Edge, Brave, Opera). "
        "Useful when the user wants to see what tabs are open."
    )
    parameters: dict = {}
    required: list[str] = []

    def run(self) -> str:
        tabs = list_chrome_tabs()
        if not tabs:
            return "No browser tabs found (or browser not supported)."
        lines = [t.get("title", "Untitled") for t in tabs]
        return "Open browser tabs:\n" + "\n".join(lines)


windows_tool = ListWindowsTool()
apps_tool = ListAppsTool()
tabs_tool = ListTabsTool()
