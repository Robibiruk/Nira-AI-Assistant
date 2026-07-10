# 🤖 NIRA - Personal AI Assistant

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?logo=fastapi)](https://fastapi.tiangolo.com/)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-000000?logo=openrouter)](https://openrouter.ai/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**NIRA** is a powerful, locally-hosted personal AI assistant that orchestrates intelligent conversations with your computer. Unlike traditional chatbots, NIRA can **execute tools** to interact with your system - opening applications, browsing the web, running terminal commands, reading and writing files, checking weather, and searching the internet.

## ✨ Key Features

### 🧠 Intelligent Orchestration
- **Multi-step tool execution** - NIRA automatically calls appropriate tools to complete your requests
- **Conversation memory** - Remembers context across sessions with SQLite-backed storage
- **Personal preferences** - Learns and remembers your name and preferences
- **Automatic model fallback** - Seamlessly switches to alternative models when rate limits are hit

### 🛠️ Built-in Tools

| Tool | Description | Example Usage |
|------|-------------|---------------|
| `open_browser` | Open web browser at any URL | "Open Chrome to github.com" |
| `run_terminal_command` | Execute shell commands | "What's my current directory?" |
| `read_file` | Read file contents | "Show me my todo.txt file" |
| `write_file` | Create or modify files | "Create a new notes file" |
| `list_directory` | List directory contents | "What's in my Documents folder?" |
| `open_app` | Launch desktop applications | "Open VS Code" |
| `get_weather` | Check current weather | "What's the weather in Paris?" |
| `web_search` | Search the web | "Find Python tutorials" |

### 🎯 Core Capabilities

- **Natural Language Understanding** - Understands and responds to natural language requests
- **Tool Integration** - Seamlessly integrates with system tools and APIs
- **Session Management** - Maintains multiple conversation sessions
- **Real-time Streaming** - Server-Sent Events (SSE) for live updates
- **Model Agnostic** - Works with any OpenRouter-compatible model

### 🎨 Modern Web UI

- **Holographic AI Core Ring** - Visual indicator showing NIRA's current state
  - 🔵 **Blue** - Thinking
  - 🟠 **Orange** - Executing tools
  - 🟢 **Green** - Speaking/Replying
  - 🔴 **Red** - Error
- **Real-time Status** - Live system status readout
- **Tool Cards** - Visual representation of available tools
- **Conversation Panel** - Clean, intuitive chat interface
- **Voice Support** - Browser-based speech-to-text and text-to-speech

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        NIRA Architecture                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   Web UI    │    │  FastAPI    │    │     Assistant       │  │
│  │   (React)   │◄───►│  Backend    │◄───►│   (Core Brain)     │  │
│  └─────────────┘    └─────────────┘    └──────────┬──────────┘  │
│                                                   │              │
│                    ┌──────────────────────────────▼──────────┐  │
│                    │                    AI Client               │  │
│                    │  (OpenRouter Integration)                 │  │
│                    └──────────────┬──────────────────────────┘  │
│                                   │                              │
│           ┌───────────────────────┼───────────────────────┐      │
│           │                       │                       │      │
│  ┌────────▼────────┐    ┌────────▼────────┐    ┌─────▼──────┐   │
│  │   Memory        │    │   Tool Manager   │    │  Runtime    │   │
│  │  (SQLite)       │    │  (Tool Router)   │    │  (State)    │   │
│  └─────────────────┘    └─────────────────┘    └────────────┘   │
│           │                       │                              │
│  ┌────────▼────────┐    ┌────────▼────────┐                   │
│  │  Preferences    │    │  Tool Registry   │                   │
│  └─────────────────┘    └────────┬─────────┘                   │
│                                        │                          │
│                 ┌──────────────────┼──────────────────┐          │
│                 │                  │                  │          │
│        ┌────────▼────┐    ┌────────▼────┐    ┌─────▼──────┐     │
│        │  Browser     │    │  Terminal    │    │  Weather   │     │
│        └──────────────┘    └──────────────┘    └────────────┘     │
│        ┌──────────────┐    ┌──────────────┐                       │
│        │    Files     │    │    Apps      │                       │
│        └──────────────┘    └──────────────┘                       │
│        ┌──────────────┐    ┌──────────────┐                       │
│        │   Search     │    │    ...       │                       │
│        └──────────────┘    └──────────────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Request → FastAPI Endpoint → Assistant → AI Model + Tools → Response
                ↑                                    ↓
            Streaming (SSE)                    Memory
                ↑                                    ↓
            Web UI ←─────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Python 3.11 or higher
- Node.js 18+ (for UI development)
- Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/nira.git
   cd nira
   ```

2. **Set up the Python environment:**
   ```bash
   # Create virtual environment (optional but recommended)
   python -m venv .venv
   
   # Activate the environment
   # Windows:
   .\.venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   
   # Install dependencies
   pip install -r requirements.txt
   ```

3. **Get an API key:**
   - Visit [OpenRouter](https://openrouter.ai/keys) to get a free API key
   - Set the key as an environment variable:
     ```bash
     # Windows (PowerShell)
     $env:OPENROUTER_API_KEY="sk-or-v1-your-api-key-here"
     
     # macOS/Linux
     export OPENROUTER_API_KEY="sk-or-v1-your-api-key-here"
     ```
   - Or add it to `config/settings.yaml`:
     ```yaml
     openrouter:
       api_key: sk-or-v1-your-api-key-here
     ```

4. **Run the backend:**
   ```bash
   uvicorn app:app --reload
   ```

5. **Test the API:**
   ```bash
   curl -X POST http://127.0.0.1:8000/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello, NIRA! What can you do?", "session_id": "default"}'
   ```

## 🎭 Running the Web UI

### Development Mode (Hot Reload)

1. **Install Node.js dependencies:**
   ```bash
   cd ui
   npm install
   cd ..
   ```

2. **Run the frontend:**
   ```bash
   cd ui
   npm run dev
   ```
   This opens http://127.0.0.1:5173 with hot reload enabled.

3. **Run the backend in another terminal:**
   ```bash
   uvicorn app:app --reload
   ```

### Production Mode (Single Process)

1. **Build the frontend:**
   ```bash
   cd ui
   npm install
   npm run build
   cd ..
   ```

2. **Run the backend (serves the built UI):**
   ```bash
   uvicorn app:app --reload
   ```
   The UI will be available at http://127.0.0.1:8000/

## 📡 API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check endpoint |
| POST | `/chat` | Non-streaming chat (returns final response) |
| POST | `/chat/stream` | Streaming chat (Server-Sent Events) |

### Configuration Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/models` | List available free models |
| POST | `/models/select` | Switch active model |
| POST | `/prefs/name` | Set user's name preference |

### Example API Usage

#### Basic Chat
```bash
curl -X POST http://127.0.0.1:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Open Chrome", "session_id": "default"}'

# Response:
# {"reply": "Opened browser at https://www.google.com"}
```

#### Streaming Chat
```bash
curl -N -X POST http://127.0.0.1:8000/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the weather in Paris?"}'

# Response (stream of events):
# data: {"type":"meta","model":"poolside/laguna-m.1:free","session":"default"}
# data: {"type":"state","state":"thinking"}
# data: {"type":"state","state":"executing","tool":"get_weather"}
# data: {"type":"tool_result","tool":"get_weather","output":"Weather in Paris: clear sky, 22°C, humidity 65%, wind 10 km/h."}
# data: {"type":"message","content":"The weather in Paris is clear with a temperature of 22°C..."}
# data: {"type":"state","state":"idle"}
```

#### List Models
```bash
curl http://127.0.0.1:8000/models

# Response:
# {
#   "current": "poolside/laguna-m.1:free",
#   "models": [
#     {"id": "poolside/laguna-m.1:free", "name": "Laguna M 1", "context_length": 128000},
#     {"id": "meta-llama/llama-3.3-70b-instruct:free", "name": "Llama 3.3 70B", "context_length": 128000},
#     ...
#   ]
# }
```

#### Switch Model
```bash
curl -X POST http://127.0.0.1:8000/models/select \
  -H "Content-Type: application/json" \
  -d '{"model": "meta-llama/llama-3.3-70b-instruct:free"}'

# Response:
# {"current": "meta-llama/llama-3.3-70b-instruct:free"}
```

#### Set User Name
```bash
curl -X POST http://127.0.0.1:8000/prefs/name \
  -H "Content-Type: application/json" \
  -d '{"name": "Robel"}'

# Response:
# {"ok": true, "name": "Robel"}
```

## ⚙️ Configuration

### Settings File

Edit `config/settings.yaml` to customize NIRA:

```yaml
# NIRA Configuration
openrouter:
  # Get a free key at https://openrouter.ai/keys
  api_key: sk-or-v1-your-api-key-here

# Model configuration
# Any OpenRouter model id works
model: poolside/laguna-m.1:free

# Voice support (future versions)
voice: false

# Memory backend
# Options: sqlite (default), chromadb (future)
memory: sqlite

# Temperature for AI responses (0.0 - 1.0)
temperature: 0.7

# Tool restrictions
# Empty list = all tools enabled
# Uncomment to restrict which tools are available
tools:
  enabled: []
  # enabled:
  #   - open_browser
  #   - run_terminal_command
  #   - read_file
  #   - write_file
  #   - list_directory
  #   - open_app
  #   - get_weather
  #   - web_search
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | OpenRouter API key | None (required) |
| `UVICORN_HOST` | Host for FastAPI server | 127.0.0.1 |
| `UVICORN_PORT` | Port for FastAPI server | 8000 |

## 📦 Project Structure

```
nira/
├── app.py                      # FastAPI application entry point
├── config.py                   # Configuration loader
├── requirements.txt            # Python dependencies
│
├── ai/
│   ├── __init__.py
│   ├── models.py               # Model identifiers and defaults
│   └── openrouter.py           # OpenRouter API client
│
├── core/
│   ├── __init__.py
│   ├── assistant.py            # Main assistant orchestration
│   ├── memory.py               # SQLite memory backend
│   ├── planner.py              # Multi-step planning (V2+)
│   ├── prompts.py              # System prompts and personality
│   ├── runtime.py              # Runtime state management
│   └── router.py               # Tool manager and registry
│
├── tools/
│   ├── __init__.py
│   ├── base.py                 # Tool contract/interface
│   ├── apps.py                 # Application launcher tool
│   ├── browser.py              # Browser tool
│   ├── files.py                # File operations tools
│   ├── search.py               # Web search tool
│   ├── terminal.py             # Terminal command tool
│   └── weather.py              # Weather tool
│
├── speech/                     # Voice support (future)
│   └── __init__.py
│
├── ui/                         # React frontend
│   ├── dist/                   # Built production files
│   ├── src/
│   │   ├── App.jsx             # Main React component
│   │   ├── main.jsx            # Entry point
│   │   ├── index.css           # Global styles
│   │   ├── components/         # React components
│   │   └── hooks/              # Custom hooks
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
│
├── config/
│   └── settings.yaml           # User configuration
│
└── database/
    └── memory.db               # SQLite database (auto-created)
```

## 🎯 Use Cases

### Everyday Tasks
- **Information Retrieval** - "What's the weather today?"
- **File Management** - "Create a new project folder and add a README"
- **Application Launching** - "Open VS Code and Chrome"
- **Web Browsing** - "Search for Python tutorials"
- **System Information** - "What's my current directory?"

### Developer Workflow
- **Code Navigation** - "Read the app.py file"
- **Project Setup** - "Create a new Flask project structure"
- **Terminal Operations** - "Run npm install in the ui folder"
- **Documentation** - "Open the FastAPI documentation"

### Productivity
- **Note Taking** - "Create a note about today's meeting"
- **Research** - "Find information about machine learning"
- **Task Automation** - "Open all my daily applications"

## 🌟 Supported AI Models

NIRA works with any **free, tool-capable** model on OpenRouter. Verified models (as of July 2026):

| Model | ID | Context Length |
|-------|-----|----------------|
| Laguna M.1 | `poolside/laguna-m.1:free` | 128,000 |
| Llama 3.3 70B | `meta-llama/llama-3.3-70b-instruct:free` | 128,000 |
| Gemma 4 31B | `google/gemma-4-31b-it:free` | 128,000 |
| GPT-OSS 120B | `openai/gpt-oss-120b:free` | 128,000 |
| Qwen3 Coder | `qwen/qwen3-coder:free` | 128,000 |

✅ **Automatic Fallback**: If a model hits its rate limit, NIRA automatically switches to another available free model.

## 🔧 Customization

### Adding New Tools

1. Create a new tool file in the `tools/` directory:

```python
"""My custom tool."""
from .base import Tool

class MyCustomTool(Tool):
    name = "my_custom_tool"
    description = "Description of what this tool does."
    
    parameters = {
        "param1": {
            "type": "string",
            "description": "First parameter description"
        },
        "param2": {
            "type": "integer",
            "description": "Second parameter description"
        }
    }
    required = ["param1"]
    
    def run(self, param1: str, param2: int = 10) -> str:
        # Your tool logic here
        return f"Result: {param1} with {param2}"

my_tool = MyCustomTool()
```

2. Register the tool in `tools/__init__.py`:

```python
from .my_custom import my_tool
```

3. Import and register in `core/router.py`:

```python
from tools.my_custom import my_tool

ALL_TOOLS = [
    # ... existing tools
    my_tool,
]
```

### Custom System Prompts

Edit `core/prompts.py` to customize NIRA's personality and behavior:

```python
SYSTEM_PROMPT = """
You are NIRA, a personal AI assistant running on the user's own machine.

Custom instructions:
- Always respond in a friendly, helpful manner
- Use tools whenever possible to complete tasks
- Remember user preferences across conversations
"""
```

## 🛡️ Security Considerations

### ⚠️ Important Security Notes

1. **Terminal Command Execution**
   - The `run_terminal_command` tool executes arbitrary shell commands
   - Only enable this tool for trusted, local use
   - Consider restricting it via `tools.enabled` in the config

2. **API Key Protection**
   - Never commit your API key to version control
   - Use environment variables for production deployments
   - The `.venv/.gitignore` already excludes the virtual environment

3. **File Access**
   - File tools can read and write any file on your system
   - NIRA respects file permissions
   - Be cautious with write operations

4. **Network Access**
   - Weather and search tools make external HTTP requests
   - Browser tool can open arbitrary URLs
   - Ensure you trust the AI model's responses

## 📊 Technical Specifications

### Backend
- **Framework**: FastAPI
- **Language**: Python 3.11+
- **Database**: SQLite (SQLAlchemy-compatible)
- **HTTP Client**: httpx
- **Logging**: loguru

### Frontend
- **Framework**: React 18+
- **Build Tool**: Vite
- **Styling**: CSS with custom animations
- **State Management**: React hooks + context

### Performance
- **Streaming**: Real-time updates via Server-Sent Events
- **Model Context**: Up to 128,000 tokens (model-dependent)
- **Tool Execution**: Up to 5 sequential tool calls per request
- **Auto-Fallback**: Seamless model switching on rate limits

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [FastAPI](https://fastapi.tiangolo.com/) - Web framework
- [OpenRouter](https://openrouter.ai/) - AI model aggregation
- [React](https://react.dev/) - Frontend framework
- [Vite](https://vitejs.dev/) - Frontend build tool
- [SQLite](https://www.sqlite.org/) - Embedded database

## 📞 Support

For issues, questions, or suggestions:

- Open an issue on GitHub
- Check the [documentation](#) (coming soon)
- Join our community (coming soon)

---

**NIRA** - Your Personal AI Assistant, Always Ready to Help

*Built with ❤️ and Python*

*"I am NIRA, your personal assistant. How may I help you today?"*
