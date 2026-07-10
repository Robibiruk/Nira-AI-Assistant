"""NIRA desktop / PC launcher.

One command to run NIRA as a local app on your PC:

    python run.py

It will:
  1. (optional) build the React UI if ui/dist is missing,
  2. start the FastAPI server (uvicorn) serving both the API and the built UI
     on http://localhost:8000.

LLM providers are read from environment variables / a .env file next to this
script. Set any of these to enable each provider (no key => provider skipped):

  OPENROUTER_API_KEY=...
  GROQ_API_KEY=...
  TOGETHER_API_KEY=...
  DEEPSEEK_API_KEY=...
  MISTRAL_API_KEY=...
  GITHUB_TOKEN=...

If no key is set, the assistant replies with a friendly note that no provider
is configured (voice + tools still work locally).
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
UI_DIR = BASE_DIR / "ui"
DIST_DIR = UI_DIR / "dist"


def _print_banner() -> None:
    print("\n" + "=" * 56)
    print("  N.I.R.A  —  local AI assistant")
    print("=" * 56 + "\n")


def _ensure_ui_built() -> None:
    if DIST_DIR.is_dir() and any(DIST_DIR.iterdir()):
        print("[ui] build present, skipping npm build.")
        return
    print("[ui] building React UI (npm run build)…")
    try:
        subprocess.run(["npm", "install"], cwd=str(UI_DIR), check=True)
        subprocess.run(["npm", "run", "build"], cwd=str(UI_DIR), check=True)
        print("[ui] build complete.")
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        print(f"[ui] could not build UI automatically ({exc}).")
        print("     Run `npm install && npm run build` in ui/ manually, then re-run.")


def _load_env() -> None:
    """Minimal .env loader so provider keys work even without `set`."""
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key, val = key.strip(), val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


def main() -> None:
    _print_banner()
    _load_env()
    _ensure_ui_built()

    host = os.getenv("NIRA_HOST", "127.0.0.1")
    port = int(os.getenv("NIRA_PORT", "8000"))

    # Import here so .env is loaded before config reads keys.
    import app as nira_app  # noqa: F401  (triggers startup provider init)

    import uvicorn

    print(f"[server] NIRA is live at  http://{host}:{port}\n")
    print("  Open that URL in your browser. Ctrl+C to stop.\n")
    uvicorn.run(nira_app.app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[NIRA] shutting down. Goodbye.")
        sys.exit(0)
