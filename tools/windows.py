"""Windows system enumeration: list open windows and running applications.

Uses pywin32 (win32gui / win32process) for window enumeration and psutil
for process/tab information. Windows-only; returns empty lists on other
platforms.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from .base import Tool

BASE_DIR = Path(__file__).resolve().parent.parent
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


# ---------------------------------------------------------------------------
# Installed apps (Start Menu scan) + app/icon resolution
# ---------------------------------------------------------------------------
def _start_menu_dirs() -> list[str]:
    dirs = []
    for base in (
        os.environ.get("ProgramData", ""),
        os.path.expandvars(r"%APPDATA%"),
    ):
        p = os.path.join(base, "Microsoft", "Windows", "Start Menu", "Programs")
        if os.path.isdir(p):
            dirs.append(p)
    return dirs


def list_installed_apps() -> list[dict]:
    """Enumerate apps from the Windows Start Menu (.lnk shortcuts).

    Returns [{name, target, icon}] where `icon` is a URL path to an
    extracted PNG (/icons/<hash>.png) when available, else "".
    """
    if not _WIN32_AVAILABLE:
        return []
    import hashlib
    import pythoncom
    from win32com.shell import shell, shellcon  # type: ignore
    from PIL import Image

    # Resolving .lnk targets via IShellLink requires an STA apartment. uvicorn
    # (and other threaded servers) run request handlers on MTA threads, where
    # GetPath() silently returns "" — which breaks icon extraction. Force STA.
    try:
        pythoncom.CoInitializeEx(pythoncom.COINIT_APARTMENTTHREADED)
    except pythoncom.com_error:
        # Already initialized (possibly as MTA); leave as-is and try anyway.
        pass

    from urllib.parse import quote

    ICON_DIR = BASE_DIR / "ui" / "public" / "icons"
    ICON_DIR.mkdir(parents=True, exist_ok=True)

    seen: set = set()
    apps: list[dict] = []
    for start_dir in _start_menu_dirs():
        for root, _dirs, files in os.walk(start_dir):
            for f in files:
                if not f.lower().endswith(".lnk"):
                    continue
                name = f[:-4]
                key = name.lower()
                if key in seen:
                    continue
                seen.add(key)
                path = os.path.join(root, f)
                icon_url = ""
                try:
                    link = pythoncom.CoCreateInstance(
                        shell.CLSID_ShellLink,
                        None,
                        pythoncom.CLSCTX_INPROC_SERVER,
                        shell.IID_IShellLink,
                    )
                    link.QueryInterface(pythoncom.IID_IPersistFile).Load(path, 0)
                    # Resolve the target executable so we can extract its icon.
                    target_buf = link.GetPath(shell.SLGP_UNCPRIORITY)[0] if hasattr(link, "GetPath") else ""
                except Exception:
                    target_buf = ""
                # Extract the app icon from the .lnk target (or the .lnk itself)
                # into a PNG. Best-effort: missing icons simply stay "".
                try:
                    icon_src = target_buf or path
                    hicon = win32gui.ExtractIcon(0, icon_src, 0)
                    if hicon and hicon != 1:  # 1 == failure sentinel
                        bmp = _icon_to_png(hicon)
                        hkey = hashlib.sha1(name.encode("utf-8")).hexdigest()[:16]
                        out = ICON_DIR / f"{hkey}.png"
                        if bmp:
                            bmp.save(out)
                            icon_url = "/icons/" + quote(out.name)
                        try:
                            win32gui.DestroyIcon(hicon)
                        except Exception:
                            pass
                except Exception:
                    pass
                apps.append({"name": name, "target": target_buf, "icon": icon_url})
    apps.sort(key=lambda a: a["name"].lower())
    return apps


def open_installed_app(name: str) -> str:
    """Launch an installed app by name (Start Menu shortcut).

    Finds the matching .lnk and opens it via the shell (which respects the
    shortcut's target/arguments). If the app is already running, we focus its
    window instead of launching a second copy.
    """
    if not _WIN32_AVAILABLE:
        return "Opening apps is only supported on Windows."
    target = (name or "").strip().lower()
    if not target:
        return "No app name provided."
    # 1) Focus an already-open window of this app, if present.
    try:
        wins = list_windows()
        for w in wins:
            if target in (w.get("title") or "").lower():
                return focus_window(w["title"], w.get("exe", ""))
    except Exception:
        pass
    # 2) Otherwise, locate the Start Menu shortcut and launch it.
    for start_dir in _start_menu_dirs():
        for root, _dirs, files in os.walk(start_dir):
            for f in files:
                if not f.lower().endswith(".lnk"):
                    continue
                if f[:-4].lower() == target or target in f[:-4].lower():
                    link_path = os.path.join(root, f)
                    try:
                        os.startfile(link_path)  # shell-open the shortcut
                        return f"Opening '{f[:-4]}'…"
                    except Exception as exc:
                        return f"Could not open '{f[:-4]}' ({exc})."
    return f"No installed app matching '{name}'."


def _icon_to_png(hicon):
    """Convert an HICON to a PIL RGBA Image. Returns None on failure."""
    from PIL import Image
    import win32ui
    from win32gui import GetIconInfo, DeleteObject

    try:
        _ficon, _x, _y, hbm_mask, hbm_color = GetIconInfo(hicon)
        DeleteObject(hbm_mask)
        if not hbm_color:
            return None
        bmp = win32ui.CreateBitmapFromHandle(hbm_color)
        info = bmp.GetInfo()
        bits = bmp.GetBitmapBits(True)
        img = Image.frombuffer(
            "RGBA", (info["bmWidth"], info["bmHeight"]), bits, "raw", "BGRA", 0, 1
        ).convert("RGBA")
        # NOTE: the raw DIB bits are already top-down (BGRA), so do NOT flip.
        DeleteObject(hbm_color)
        return img
    except Exception:
        return None


def focus_window(title: str, exe: str = "") -> str:
    """Bring the window matching `title` (and optionally `exe`) to the foreground."""
    if not _WIN32_AVAILABLE:
        return "Window focus is only supported on Windows."
    best = None
    matches: list = []

    def enum_callback(hwnd, _):
        if _is_alt_tab_window(hwnd):
            t = _get_window_title(hwnd)
            if title.lower() in t.lower():
                matches.append(hwnd)
        return True

    win32gui.EnumWindows(enum_callback, None)
    if not matches:
        return f"No open window matching '{title}'."
    best = matches[0]
    try:
        win32gui.ShowWindow(best, win32con.SW_RESTORE)
        win32gui.SetForegroundWindow(best)
        # Flash to signal the switch (best-effort).
        return f"Brought '{title}' to the foreground."
    except Exception as exc:
        return f"Could not focus '{title}' ({exc})."


def close_window(title: str, exe: str = "") -> str:
    """Close the window matching `title`."""
    if not _WIN32_AVAILABLE:
        return "Window close is only supported on Windows."
    matches: list = []

    def enum_callback(hwnd, _):
        if _is_alt_tab_window(hwnd):
            t = _get_window_title(hwnd)
            if title.lower() in t.lower():
                e = ""
                try:
                    _, pid = win32process.GetWindowThreadProcessId(hwnd)
                    e = psutil.Process(pid).name()
                except Exception:
                    pass
                if not exe or e.lower() == exe.lower():
                    matches.append(hwnd)
        return True

    win32gui.EnumWindows(enum_callback, None)
    if not matches:
        return f"No open window matching '{title}'."
    closed = 0
    for hwnd in matches:
        try:
            win32gui.PostMessage(hwnd, win32con.WM_CLOSE, 0, 0)
            closed += 1
        except Exception:
            pass
    return f"Closed {closed} window(s) matching '{title}'."


def focus_browser_tab(query: str) -> str:
    """Best-effort: focus the browser window whose title contains `query`.

    True per-tab activation isn't exposed via Win32; we foreground the
    browser window that contains the tab title.
    """
    if not _WIN32_AVAILABLE:
        return "Browser tab focus is only supported on Windows."
    for proc in psutil.process_iter(["name"]):
        name = (proc.info["name"] or "").lower()
        if name in {"chrome", "msedge", "brave", "opera", "chromium"}:
            try:
                hwnds = _find_child_windows(proc.info["pid"] if proc.info.get("pid") else None)
            except Exception:
                hwnds = []
            for hwnd in hwnds:
                t = _get_window_title(hwnd)
                if query.lower() in t.lower():
                    try:
                        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                        win32gui.SetForegroundWindow(hwnd)
                        return f"Focused browser window containing '{query}'."
                    except Exception:
                        pass
    return f"No browser window containing '{query}'."


def close_browser_tab(query: str) -> str:
    """Close the browser window whose title contains `query` (per-tab close
    isn't exposed via Win32, so we close the whole window)."""
    if not _WIN32_AVAILABLE:
        return "Browser tab close is only supported on Windows."
    closed = 0
    for proc in psutil.process_iter(["name", "pid"]):
        name = (proc.info["name"] or "").lower()
        if name not in {"chrome", "msedge", "brave", "opera", "chromium"}:
            continue
        for hwnd in _find_child_windows(proc.info.get("pid")):
            t = _get_window_title(hwnd)
            if query.lower() in t.lower():
                try:
                    win32gui.PostMessage(hwnd, win32con.WM_CLOSE, 0, 0)
                    closed += 1
                except Exception:
                    pass
    return f"Closed {closed} browser window(s) containing '{query}'."


class InstalledAppsTool(Tool):
    name = "list_installed_apps"
    description = (
        "List applications installed on the Windows machine (from the Start Menu). "
        "Returns app names, their launch target, and an icon URL. "
        "Useful when the user wants to see or open installed apps."
    )
    parameters: dict = {}
    required: list[str] = []

    def run(self) -> str:
        apps = list_installed_apps()
        if not apps:
            return "No installed apps found (or not supported on this platform)."
        lines = [f"{a['name']}" for a in apps]
        return "Installed apps:\n" + "\n".join(lines)


class OpenInstalledAppTool(Tool):
    name = "open_installed_app"
    description = (
        "Launch (or focus) an installed Windows app by name. "
        "Use when the user wants to open a specific installed application from the Apps page."
    )
    parameters = {"name": {"type": "string", "description": "Name of the installed app to open."}}
    required = ["name"]

    def run(self, name: str) -> str:
        return open_installed_app(name)


class FocusWindowTool(Tool):
    name = "focus_window"
    description = (
        "Bring an open desktop window to the foreground by (partial) title. "
        "Use when the user wants to switch to / jump to a specific open app or window."
    )
    parameters = {
        "title": {"type": "string", "description": "Title or partial title of the window to focus."},
        "exe": {"type": "string", "description": "Optional executable name to disambiguate."},
    }
    required = ["title"]

    def run(self, title: str, exe: str = "") -> str:
        return focus_window(title, exe)


class CloseWindowTool(Tool):
    name = "close_window"
    description = (
        "Close an open desktop window by (partial) title. "
        "Use when the user wants to close a specific open app or window."
    )
    parameters = {
        "title": {"type": "string", "description": "Title or partial title of the window to close."},
        "exe": {"type": "string", "description": "Optional executable name to disambiguate."},
    }
    required = ["title"]

    def run(self, title: str, exe: str = "") -> str:
        return close_window(title, exe)


class FocusTabTool(Tool):
    name = "focus_browser_tab"
    description = (
        "Bring the browser window containing a tab title to the foreground. "
        "Use when the user wants to jump to a specific open browser tab."
    )
    parameters = {"query": {"type": "string", "description": "Tab title or partial title to focus."}}
    required = ["query"]

    def run(self, query: str) -> str:
        return focus_browser_tab(query)


class CloseTabTool(Tool):
    name = "close_browser_tab"
    description = (
        "Close the browser window containing a tab title. "
        "Use when the user wants to close a specific open browser tab/window."
    )
    parameters = {"query": {"type": "string", "description": "Tab title or partial title to close."}}
    required = ["query"]

    def run(self, query: str) -> str:
        return close_browser_tab(query)


installed_apps_tool = InstalledAppsTool()
open_installed_app_tool = OpenInstalledAppTool()
focus_window_tool = FocusWindowTool()
close_window_tool = CloseWindowTool()
focus_tab_tool = FocusTabTool()
close_tab_tool = CloseTabTool()
