# Contributing to Nira AI

First of all, thank you for your interest in contributing to Nira AI! 🎉

We welcome bug reports, feature requests, documentation improvements, UI enhancements, and code contributions from developers of all experience levels.

---

## Getting Started

1. Fork the repository.
2. Clone your fork.

   ```bash
   git clone https://github.com/Robibiruk/nira-ai.git
   cd nira-ai
   ```

3. Install backend dependencies.

   ```bash
   python -m venv .venv
   source .venv/bin/activate   # Windows: .\.venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. Install frontend dependencies.

   ```bash
   cd ui
   npm install
   cd ..
   ```

5. Create a new branch.

   ```bash
   git checkout -b feature/my-feature
   ```

---

## Project Layout

- `app.py` — FastAPI backend entry point (also serves the built UI).
- `config.py` — configuration loader.
- `ai/` — OpenRouter client and model definitions.
- `core/` — assistant orchestration, memory, planner, prompts, runtime, router.
- `tools/` — built-in tools (browser, terminal, files, search, apps, weather).
- `speech/` — voice support (speech-to-text + text-to-speech).
- `ui/` — Vite + React frontend (JSX, plain CSS).
- `config/` — `settings.yaml` user configuration.
- `database/` — SQLite memory store (auto-created).

---

## Development Guidelines

Please:

- Write clean and readable code.
- Follow the existing project structure.
- Keep React components modular and reusable.
- Use plain CSS (no Tailwind) in the UI.
- Write meaningful commit messages.
- Test your changes before submitting.

### Running locally

```bash
# Terminal 1 — backend
uvicorn app:app --reload

# Terminal 2 — frontend (hot reload)
cd ui && npm run dev
```

The UI is available at http://127.0.0.1:5173 and proxies API calls to the
backend on port 8000.

---

## Pull Requests

When submitting a pull request:

- Explain what changed.
- Include screenshots for UI changes.
- Link any related issues.
- Keep PRs focused on one feature or fix.

---

## Reporting Bugs

When opening an issue, please include:

- Operating System
- Python version
- Browser (if applicable)
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots (if possible)

---

## Suggesting Features

Feature requests should include:

- Problem statement
- Proposed solution
- Possible implementation
- Mockups (optional)

---

## Code Style

### Python

- Follow PEP 8
- Use type hints
- Write docstrings where appropriate

### React / JavaScript (JSX)

- Functional components
- Plain CSS for styling (no Tailwind)
- Keep components modular

---

## Adding a Tool

1. Create `tools/my_tool.py` subclassing `Tool` from `tools.base`.
2. Export the instance and register it in `tools/__init__.py`.
3. Add it to `ALL_TOOLS` in `core/router.py`.

See `core/router.py` and the existing `tools/*.py` files for the contract.

---

## Community

Be respectful and constructive. We strive to create a welcoming environment
where everyone can learn and contribute.

---

## License

By contributing to Nira AI, you agree that your contributions will be licensed
under the MIT License.

Happy coding! 🚀
