# 🤖 NIRA — Personal AI Assistant

**NIRA** is a locally-hosted, privacy-first personal AI assistant that bridges natural-language conversation with real control of your computer. It runs a FastAPI backend on your machine and a polished, installable web UI (PWA) so it feels like a native desktop app. NIRA can talk — with natural, sentence-level streaming voice — and it can *act*: open apps, browse the web, run terminal commands, read/write files, check the weather, and search the internet, all orchestrated by an LLM through OpenRouter.

> Built by **Robel Biruk** — pharmacy student and software developer passionate about AI, automation and human-centered interfaces.

---

## ✨ Features

### 💬 Conversational Core
- **Multi-step tool orchestration** — NIRA automatically decides which tools to call and chains them to complete a request.
- **Streaming responses** — live Server-Sent Events (SSE) token/state streaming, with a visible "thinking → executing → speaking" core ring.
- **Conversation memory** — every chat is saved as a named session in SQLite and survives reloads.
- **Inline session management** — rename a session by clicking its title, delete via a confirmation popover (no browser alerts).
- **Personalized greeting** — NIRA learns your name (first-run modal) and greets you by time of day.
- **Automatic model fallback** — when the active model hits a rate limit, NIRA seamlessly switches to another available free model.

### 🎙️ Voice (completed)
- **Speech-to-text** — tap the core / mic to dictate; your speech is transcribed and sent as a message.
- **Natural text-to-speech** — replies are spoken with **sentence-level streaming** (Kokoro / streaming TTS), prefetching the next sentence so there is no robotic pause between phrases. Tap the core to interrupt speech.
- **Voice toggle** in the activity panel; mic state shown on the core ring.

### 🛠️ Built-in Tools
| Tool | Description | Example |
|------|-------------|---------|
| `open_browser` | Open a URL in your default browser | "Open GitHub" |
| `run_terminal_command` | Execute a shell command | "What's my IP?" |
| `read_file` / `write_file` | Read or create/modify files | "Create a notes file" |
| `list_directory` | List a directory's contents | "What's in Documents?" |
| `open_app` | Launch a desktop application | "Open VS Code" |
| `get_weather` | Current weather for a city | "Weather in Paris?" |
| `web_search` | Web search | "Find Python tutorials" |
| `desktop` | List installed/running apps & windows (Apps page) | "What's open?" |
| `desktop/action` | Focus / close / launch a desktop app | "Close Chrome" |

Tools can also be invoked directly with **slash commands** (e.g. `/tools`, `/clear`, `/model`, `/help`) which bypass the LLM and call the backend.

### 🖥️ App Surfaces (UI pages)
- **Chat** — the main conversation with the holographic AI core ring.
- **Memory** — all saved sessions; resume, inline-rename, or delete.
- **Apps** — desktop control: see installed apps, running windows, and browser tabs; launch or close them (with a one-time permission grant).
- **Browser** — web browsing surface driven by the browser tool.
- **Research** — research/summarization workflow.
- **About** — project info: version, live statistics, creator, roadmap, license, contributing, and a scrolling footer marquee.
- **Settings** — switch models, add/remove AI providers (OpenRouter + custom providers), and set per-tool API keys (Google, GitHub, Spotify, …).

### 🎨 Design & UX
- **Holographic AI Core Ring** — color-coded state indicator:
  - 🔵 Blue — Thinking
  - 🟠 Orange — Executing tools
  - 🟢 Green — Speaking / replying
  - 🔴 Red — Error
  - 🎤 Mic — Listening
- **JARVIS / Apple-Vision-Pro-inspired dark UI** — cyan + purple neon, glassmorphism, 48px grid, responsive from 360px to 4K.
- **Custom scrollbars** restyled app-wide (thin cyan thumb).
- **Font Awesome** brand + UI icons, **Audiowide** display font for hero text.

### 📦 Progressive Web App (PWA)
- Installable: "Install app" / "Add to Home Screen" from any modern browser.
- Ships a `manifest.webmanifest` (`display: standalone`, `orientation: any`) and a service worker (`sw.js`) that caches the production bundle for offline use.
- The service worker is registered **only in production builds** (dev keeps HMR clean).

### 🔌 Extensibility
- **Model selection** at runtime; any OpenRouter-compatible model works.
- **Custom providers** — add your own OpenAI-compatible endpoints in Settings.
- **Tool API keys** — supply keys for external tools without editing config files.
- **Feature toggles** — enable/disable capabilities from the activity panel (persisted server-side).
- Adding a tool is a matter of subclassing `Tool` in `tools/` and registering it.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          NIRA Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   Web UI    │    │  FastAPI    │    │     Assistant       │  │
│  │   (React)   │◄──►│  Backend    │◄──►│   (Core Brain)     │  │
│  │  (PWA/Vite) │    │  app.py     │    │  core/assistant.py │  │
│  └─────────────┘    └─────────────┘    └──────────┬──────────┘  │
│                                                   │              │
│                    ┌──────────────────────────────▼──────────┐  │
│                    │            AI Client (OpenRouter)        │  │
│                    └──────────────┬──────────────────────────┘  │
│                                   │                              │
│           ┌───────────────────────┼───────────────────────┐      │
│           │                       │                       │      │
│  ┌────────▼────────┐    ┌────────▼────────┐    ┌─────▼──────┐   │
│  │   Memory        │    │   Tool Manager   │    │  Runtime    │   │
│  │  (SQLite)       │    │  (router/registry)│   │  (State)    │   │
│  └─────────────────┘    └─────────────────┘    └────────────┘   │
│           │                       │                              │
│  ┌────────▼────────┐    ┌────────▼────────┐                   │
│  │  Preferences    │    │  Tool Registry   │                   │
│  └─────────────────┘    └────────┬─────────┘                   │
│                                        │                          │
│        ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│        │  Browser   │  │  Terminal  │  │  Weather    │  ...      │
│        └────────────┘  └────────────┘  └────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow
```
User Request → FastAPI Endpoint → Assistant → AI Model + Tools → Response
                ↑                                    ↓
            Streaming (SSE)                    Memory / Speech
                ↑                                    ↓
            Web UI (PWA) ←─────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Git

### 1. Clone
```bash
git clone https://github.com/Robibiruk/nira-ai.git
cd nira-ai
```

### 2. Backend
```bash
python -m venv .venv
# Windows
.\.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 3. API key
Get a free key at [OpenRouter](https://openrouter.ai/keys) and set it:
```bash
# PowerShell
$env:OPENROUTER_API_KEY="sk-or-..."
# macOS / Linux
export OPENROUTER_API_KEY="sk-or-..."
```
Or put it in `config/settings.yaml` under `openrouter.api_key` (see `config/settings.yaml.example`).

### 4. Run the backend
```bash
uvicorn app:app --reload
```
Backend serves on http://127.0.0.1:8000 (and serves the built UI in production).

### 5. Frontend (dev)
```bash
cd ui
npm install
npm run dev      # http://127.0.0.1:5173 (proxies API to :8000)
```

### 6. Production build + serve
```bash
cd ui
npm run build    # outputs ui/dist
cd ..
uvicorn app:app --reload   # serves the built PWA at http://127.0.0.1:8000
```

### Install as an app (PWA)
In a supported browser, open the running app and choose **Install app** / **Add to Home Screen**. The service worker caches the bundle so NIRA works offline.

---

## 📡 API Endpoints

### Core
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/chat` | Non-streaming chat (final reply) |
| POST | `/chat/stream` | Streaming chat (SSE: meta → state → tool_result → message) |
| POST | `/tools/run` | Run a tool directly (slash commands) |

### Config & State
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/models` | List available models |
| POST | `/models/select` | Switch active model |
| GET | `/providers` | List configured providers |
| GET/POST | `/providers/custom` | List / add / remove custom providers |
| GET/POST | `/tools/keys` | List / set per-tool API keys |
| GET/POST | `/features` | List / toggle feature flags |
| GET | `/status` | Runtime status readout |

### Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sessions` | List saved sessions |
| GET | `/sessions/{sid}` | Load a session's messages |
| POST | `/sessions/rename` | Rename a session |
| POST | `/sessions/delete` | Delete a session |

### Desktop & Voice
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/desktop` | Installed apps, running windows, browser tabs |
| POST | `/desktop/action` | Focus / close / launch a desktop app |
| POST | `/prefs/name` | Set the user's name |
| POST | `/speak` | Text-to-speech synthesis |

---

## ⚙️ Configuration

`config/settings.yaml` (copy `config/settings.yaml.example` → `config/settings.yaml`):

```yaml
openrouter:
  api_key: sk-or-...        # or set OPENROUTER_API_KEY env var
model: poolside/laguna-m.1:free
voice: true                 # enable voice (speech-to-text + TTS)
memory: sqlite              # memory backend
temperature: 0.7
tools:
  enabled: []               # empty = all tools enabled
```

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | OpenRouter API key (required) | — |
| `UVICORN_HOST` | FastAPI host | 127.0.0.1 |
| `UVICORN_PORT` | FastAPI port | 8000 |

---

## 📦 Project Structure

```
nira-ai/
├── app.py                  # FastAPI entry point (also serves built UI)
├── config.py               # Configuration loader
├── requirements.txt        # Python dependencies
├── ai/                     # AI client + model registry
│   ├── openrouter.py       # OpenRouter client
│   ├── provider.py         # Provider abstraction
│   ├── providers.py        # Built-in + custom providers
│   └── models.py           # Model ids / defaults
├── core/                   # Assistant brain
│   ├── assistant.py        # Orchestration
│   ├── memory.py           # SQLite memory
│   ├── planner.py          # Multi-step planning
│   ├── prompts.py          # System prompt / personality
│   ├── runtime.py          # Runtime state
│   └── router.py           # Tool manager + registry
├── tools/                  # Built-in tools
│   ├── base.py             # Tool contract
│   ├── apps.py             # App launcher / desktop control
│   ├── browser.py          # Browser
│   ├── files.py            # File read/write
│   ├── search.py           # Web search
│   ├── terminal.py         # Terminal
│   └── weather.py          # Weather
├── speech/                 # Voice (STT + streaming TTS)
├── ui/                     # Vite + React PWA frontend
│   ├── public/             # manifest.webmanifest, sw.js, icons, Me.jpg
│   ├── src/
│   │   ├── App.jsx         # App shell + routing
│   │   ├── main.jsx        # Entry + SW registration
│   │   ├── index.css       # Global styles
│   │   ├── api.js          # API client
│   │   ├── hooks/          # useNira, useVoice
│   │   └── components/     # Chat, Memory, Apps, Browser, Research,
│   │                       #   About, Settings, Sidebars, …
│   ├── package.json
│   └── vite.config.js
├── config/
│   └── settings.yaml       # User config (git-ignored)
└── database/
    └── memory.db           # SQLite store (auto-created, git-ignored)
```

---

## 🧭 Roadmap

**Completed**
- Smart Chat
- Browser
- File Tools
- Research
- Voice Assistant

**Upcoming**
- Plugin Marketplace
- Mobile App
- Multi-Agent System
- Smart Home Integration

---

## 🌟 Supported Models

NIRA works with any **free, tool-capable** OpenRouter model. Verified (as of July 2026):

| Model | ID | Context |
|-------|-----|---------|
| Laguna M.1 | `poolside/laguna-m.1:free` | 128,000 |
| Llama 3.3 70B | `meta-llama/llama-3.3-70b-instruct:free` | 128,000 |
| Gemma 4 31B | `google/gemma-4-31b-it:free` | 128,000 |
| GPT-OSS 120B | `openai/gpt-oss-120b:free` | 128,000 |
| Qwen3 Coder | `qwen/qwen3-coder:free` | 128,000 |

Automatic fallback switches models on rate-limit.

---

## 🔧 Customization

### Add a tool
1. `tools/my_tool.py` subclassing `Tool` (from `tools.base`):
   ```python
   from .base import Tool
   class MyTool(Tool):
       name = "my_tool"
       description = "What it does."
       parameters = {"q": {"type": "string", "description": "Query"}}
       required = ["q"]
       def run(self, q: str) -> str:
           return f"Result: {q}"
   my_tool = MyTool()
   ```
2. Export it in `tools/__init__.py` and add to `ALL_TOOLS` in `core/router.py`.

### Custom system prompt
Edit `core/prompts.py`.

### Custom providers
Add an OpenAI-compatible endpoint in **Settings → Providers** (no code needed).

---

## 🛡️ Security

- **Terminal execution** runs arbitrary shell commands — only enable for trusted local use; restrict via `tools.enabled`.
- **API keys** are never committed (see `.gitignore`); use env vars or `config/settings.yaml` (git-ignored).
- **File tools** can read/write any file on your system.
- Everything runs **locally** — your conversations stay on your machine (SQLite).

---

## 📄 License & Contributing

NIRA is open source under the **MIT License** — see [LICENSE.md](LICENSE.md).
Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 🔗 Connect

- GitHub: [@Robibiruk](https://github.com/Robibiruk)
- LinkedIn: [Robel Biruk](https://www.linkedin.com/in/robel-biruk-5923101b5/)
- Portfolio: [robel-portfolio-website.netlify.app](https://robel-portfolio-website.netlify.app/)

Made with 💙 by **Robel Biruk** — © 2026 Nira AI.
