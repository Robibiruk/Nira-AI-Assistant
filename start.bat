@echo off
REM JARVIS one-click PC launcher (Windows).
REM 1) make sure you created .env with your API keys (copy from .env.example)
REM 2) double-click this file (or run: python run.py)
cd /d "%~dp0"
if not exist ".venv" (
  echo Creating virtual environment…
  python -m venv .venv
)
call .venv\Scripts\activate.bat
python -m pip install -q -r requirements.txt
python run.py
pause
