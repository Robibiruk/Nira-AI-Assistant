# 🤖 NIRA — Personal AI Assistant

**NIRA** is a privacy-first personal AI assistant that bridges natural-language conversation with real tools and a workspace for your work. It runs a FastAPI backend and a polished, installable web UI (PWA) so it feels like a native desktop app. NIRA can talk — with natural, sentence-level streaming voice — and it can *act*: browse the web, run terminal commands, read/write files, check the weather, and search the internet, all orchestrated by an LLM through OpenRouter.

> Built by **Robel Biruk** — pharmacy student and software developer passionate about AI, automation and human-centered interfaces.

---

## ✨ Features

### 💬 Conversational Core
- **Multi-step tool orchestration** — NIRA automatically decides which tools to call and chains them to complete a request.
- **Streaming responses** — live Server-Sent Events (SSE) token/state streaming, with a visible "thinking → executing → speaking" core ring.
- **Conversation memory** — every chat is saved as a named session. Memory is **local-first** (browser `localStorage`, so it always survives reloads) and **synced to Firebase Firestore** per anonymous user for cross-device access.
- **Inline session management** — rename a session by clicking its title, delete via a confirmation popover (no browser alerts).
- **Personalized greeting** — NIRA asks your name once (first-run modal) and greets you by time of day ("Hello you" for new users, "Hello {name}" after).
- **Automatic model fallback** — when the active model hits a rate limit, NIRA seamlessly switches to another available free model.

### 🎙️ Voice
- **Speech-to-text** — tap the core / mic to dictate; your speech is transcribed and sent as a message.
- **Natural text-to-speech** — replies are spoken with **sentence-level streaming** via the browser's Web Speech API (keyless, no external dependency), prefetching the next sentence so there is no robotic pause between phrases. Tap the core to interrupt speech.
- **Voice toggle** in the activity panel; mic state shown on the core ring.

### 📁 Projects (workspace)
- Group everything related to one goal into a **Project**: chats, memories, notes and research.
- Create projects with a name, emoji icon and description.
- Each project card shows 💬 chats / 🧠 memories / 🔬 research counts + last active.
- Tag the current chat to a project from the **Project** dropdown in Chat, so it appears under that project.
- Projects persist locally and sync to Firebase (under `users/{uid}/projects`).

### 🛠️ Built-in Tools
| Tool | Description | Example |
|------|-------------|---------|
| `open_browser` | Open a URL in your default browser | "Open GitHub" |
| `run_terminal_command` | Execute a shell command | "What's my IP?" |
| `read_file` / `write_file` | Read or create/modify files | "Create a notes file" |
| `list_directory` | List a directory's contents | "What's in Documents?" |
| `get_weather` | Current weather + forecast for a city (Open-Meteo with wttr.in fallback) | "Weather in Paris?" |
| `web_search` | Web search (Tavily, key from `TAVILY_API_KEY` env) | "Find Python tutorials" |
| `browser` | Browsing surface driven by the browser tool | "Summarize this page" |

Tools can also be invoked directly with **slash commands** (e.g. `/tools`, `/clear`, `/model`, `/help`) which bypass the LLM and call the backend.

### 🖥️ App Surfaces (UI pages)
- **Chat** — the main conversation with the holographic AI core ring.
- **Memory** — all saved sessions; resume, inline-rename, or delete.
- **Projects** — workspace: create projects, see conversations/memories/notes/research grouped by project.
- **Browser** — web browsing surface driven by the browser tool.
- **Research** — research/summarization workflow.
- **About** — project info: version, live statistics, creator, roadmap, license, contributing, and a scrolling footer marquee.
- **Settings** — switch models, add/remove AI providers (OpenRouter + custom providers), and set per-tool API keys (Google, GitHub, Spotify, Tavily, …).

### 🆕 What's New

A snapshot of the capabilities added in the latest releases — smarter research, secure account connections, and a transparent "thinking" layer.

```
┌──────────────────────────────────────────────────────────────────────┐
│                       NIRA — New Capabilities                          │
├────────────────┬───────────────────────────────────────────────────── ┤
│  🌐 Web        │  Smart research agent — reads real pages, not just    │
│                │  snippet dumps. Streams its steps, then answers.       │
│  🔗 OAuth      │  One-click Connect for Google (Gmail), GitHub,         │
│                │  Spotify — per-user tokens, nothing shared.            │
│  💡 Reasoning  │  Live "Thinking…" stream shown before the answer.      │
│  🧠 Memory     │  Local-first + Firebase sync, fully private.           │
└────────────────┴─────────────────────────────────────────────────────┘
```

#### 🌐 Web — Smart Research

The `web` tool runs an autonomous fetch-based research loop: it searches, opens
the most relevant result, reads the page, and synthesises a sourced answer —
all within a 512 MB cloud footprint (no headless Chromium required).

```
  ┌────────┐   search    ┌──────────┐   pick + fetch   ┌───────────┐
  │  Query │ ──────────► │  Search  │ ───────────────► │  Content  │
  └────────┘             │  (Tavily │                  │   Page    │
       ▲                 │  → DDG → │                  └─────┬─────┘
       │                 │   Wiki)  │                        │ read
       │   answer +      └──────────┘                        ▼
       │   source                                     ┌────────────┐
       └─────────────────────────────────────────────│  Summarise │
                                                      └────────────┘
   Output:  [web · fetch · N steps]  +  answer  +  🔗 source link
```

- **Resilient search chain** — Tavily (datacenter-friendly) → DuckDuckGo HTML → Wikipedia fallback, so it always returns something useful.
- **Never loops** — a step-limit safety net summarises the best page it found instead of failing.
- **Honest** — cites the page it read; says so when a source doesn't fully cover the question.

#### 🔗 OAuth Tool Connections

Connect real accounts from **Settings → Tool Connections** — each user's tokens
are isolated (no shared credentials), and every tool returns **actionable**
errors (exact console fix) instead of raw exceptions.

```
   User ──Connect──► OAuth Consent ──token──► Encrypted per-user store
                                                      │
                    ┌─────────────────┬───────────────┼───────────────┐
                    ▼                 ▼               ▼                 ▼
                 📧 Gmail          🐙 GitHub       🎧 Spotify      🔑 API keys
              (read/summarise)   (search/repos)   (search/play)   (Tavily, …)
```

| Connection | Unlocks | Notes |
|------------|---------|-------|
| **Google** | `gmail` — list / read / summarise mail | Add yourself as a Test User if the app is unverified |
| **GitHub** | repo & code search | Fine-grained token scopes |
| **Spotify** | search & playback control | Auto token via Client Credentials |
| **API keys** | Tavily and other keyed tools | Env vars win over Settings |

#### 💡 Live Reasoning ("Thinking-first")

With a reasoning-capable model (e.g. `deepseek/deepseek-r1:free`,
`qwen/qwq-32b:free`), NIRA shows its work **before** the answer — the wait
becomes a live, pulsing "💡 Thinking…" stream that quietly collapses once the
reply begins.

```
   ┌── while reasoning ──┐          ┌── once answering ──┐
   │  💡 Thinking…       │  ──────► │  ▸ 💡 Reasoning     │  (collapsed)
   │  · streams live     │  answer  │  ────────────────── │
   │  · gently pulses    │  starts  │  Answer leads ↴     │
   └─────────────────────┘          └────────────────────┘
```

- Captured from native `reasoning` fields **and** inline `<think>` tags.
- Purely additive — non-reasoning models simply don't show the block.

### 🖼️ Favicons
NIRA ships a favicon **set** (not a single file) so every device picks the right
resolution. They live in `ui/public/` and are referenced from `ui/index.html`:

| File | Size | Used for |
|------|------|----------|
| `favicon-16.png` | 16×16 | Small browser-tab icons, bookmark bars |
| `favicon-32.png` | 32×32 | Standard desktop tab / taskbar |
| `favicon-70.png` | 70×70 | Windows tiles / medium shortcuts |
| `favicon-96.png` | 96×96 | High-DPI tabs, Android home-screen, `apple-touch-icon` |

The browser's `<link rel="icon" sizes="…">` + `srcSet`/`sizes` attributes let it
choose the closest size for the current device pixel ratio — e.g. a 2× Retina tab
uses `favicon-32.png` (rendered at 16 CSS px), a 3× phone uses `favicon-96.png`.
The same set is reused in `manifest.webmanifest` (maskable + any-purpose) so the
installed PWA icon looks crisp on phones and tablets. To change the logo, replace
all four PNGs at the sizes above (keep the names) — no code change needed.

### 📦 Progressive Web App (PWA)
- Installable: "Install app" / "Add to Home Screen" from any modern browser.
- Ships a `manifest.webmanifest` (`display: standalone`, `orientation: any`) and a service worker (`sw.js`) that caches the production bundle for offline use.
- The service worker is registered **only in production builds** (dev keeps HMR clean).

### 🔌 Extensibility
- **Model selection** at runtime; any OpenRouter-compatible model works.
- **Custom providers** — add your own OpenAI-compatible endpoints in Settings.
- **Tool API keys** — supply keys for external tools (e.g. Tavily) via the `TAVILY_API_KEY` env var or Settings; environment variables take priority.
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
│  │ (localStorage + │    │  (router/registry)│   │  (State)    │   │
│  │   Firestore)    │    │                   │   │             │   │
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

**Memory storage:** chat sessions and the user's name are stored **local-first in `localStorage`** (guaranteed to work, survives reloads) and **mirrored to Firebase Firestore** (`users/{uid}/sessions`, `users/{uid}/projects`) when an anonymous account is available. Anonymous auth + per-uid Firestore rules keep data private.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Git

### 1. Clone
```bash
git clone https://github.com/Robibiruk/Nira-AI-Assistant.git
cd Nira-AI-Assistant
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

### Tools & Weather
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/desktop` | Installed apps, running windows, browser tabs (desktop builds) |
| POST | `/desktop/action` | Focus / close / launch a desktop app |
| POST | `/speak` | Text-to-speech synthesis (browser TTS on the client) |

> Sessions/name are managed **client-side** (localStorage + Firebase), so there are no `/sessions` server endpoints — the backend is stateless for chat history.

---

## ⚙️ Configuration

`config/settings.yaml` (copy `config/settings.yaml.example` → `config/settings.yaml`):

```yaml
openrouter:
  api_key: sk-or-...        # or set OPENROUTER_API_KEY env var
model: poolside/laguna-m.1:free
voice: true                 # enable voice (speech-to-text + TTS)
temperature: 0.7
tools:
  enabled: []               # empty = all tools enabled
```

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | OpenRouter API key (required) | — |
| `TAVILY_API_KEY` | Tavily web-search key (optional; env wins over config) | — |
| `SPOTIFY_CLIENT_ID` | Spotify app Client ID — enables automatic token fetch (Client Credentials) so Spotify works without manual tokens and survives restarts | — |
| `SPOTIFY_CLIENT_SECRET` | Spotify app Client Secret (paired with `SPOTIFY_CLIENT_ID`) | — |
| `SPOTIFY_API_KEY` | Optional: a manually-pasted Spotify access token (overrides the above). Short-lived — refresh when requests 401 | — |
| `UVICORN_HOST` | FastAPI host | 127.0.0.1 |
| `UVICORN_PORT` | FastAPI port | 8000 |

### Frontend env (Vercel / `ui/.env`)
| Variable | Description |
|----------|-------------|
| `VITE_API_BASE` | Backend base URL (e.g. `https://nira-ai-backend.onrender.com`) |
| `VITE_FIREBASE_API_KEY` | Firebase web API key (the only Firebase value wired to env; others are hardcoded in `firebase.js`) |

---

## 📦 Project Structure

```
Nira-AI-Assistant/
├── app.py                  # FastAPI entry point (also serves built UI)
├── config.py               # Configuration loader
├── requirements.txt        # Python dependencies
├── ai/                     # AI client + model registry
│   ├── openrouter.py       # OpenRouter client
│   ├── provider.py         # Provider abstraction
│   ├── providers.py        # Built-in + custom providers
│   └── models.py           # Model ids / defaults
├── core/                   # Assistant brain
│   ├── assistant.py        # Orchestration (stateless; gets history from client)
│   ├── planner.py          # Multi-step planning
│   ├── prompts.py          # System prompt / personality
│   ├── runtime.py          # Runtime state
│   └── router.py           # Tool manager + registry
├── tools/                  # Built-in tools
│   ├── base.py             # Tool contract
│   ├── browser.py          # Browser
│   ├── files.py            # File read/write
│   ├── search.py           # Web search (Tavily)
│   ├── terminal.py         # Terminal
│   ├── weather.py          # Weather (Open-Meteo + wttr.in fallback)
│   └── _keys.py            # Per-tool key resolution (env > config)
├── ui/                     # Vite + React PWA frontend
│   ├── public/             # manifest.webmanifest, sw.js, icons, Me.jpg, fontawesome/
│   ├── src/
│   │   ├── App.jsx         # App shell + routing
│   │   ├── main.jsx        # Entry + SW registration
│   │   ├── index.css       # Global styles
│   │   ├── api.js          # API client
│   │   ├── firebase.js     # Firebase init + per-uid Firestore helpers
│   │   ├── memoryStore.js  # Local-first localStorage persistence
│   │   ├── utils.js         # Shared helpers (date formatting)
│   │   ├── hooks/          # useNira, useVoice
│   │   └── components/     # Chat, Memory, Projects, Browser, Research,
│   │                       #   About, Settings, Sidebars, …
│   ├── package.json
│   └── vite.config.js
├── config/
│   └── settings.yaml       # User config (git-ignored)
└── firestore.rules         # Per-uid Firestore security rules
```

---

## 🧭 Roadmap

**Completed**
- Smart Chat
- Browser
- File Tools
- Research
- Voice Assistant
- Projects (workspace)
- Local-first memory + Firebase sync

**Upcoming**
- Plugin Marketplace
- Mobile App
- Multi-Agent System
- Smart Home Integration
- File/image attachments inside Projects (Firebase Storage ready)

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
- **Memory is private** — chat history lives in your browser (`localStorage`) and your own Firebase account (anonymous auth, per-uid Firestore rules). No shared server database.

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
