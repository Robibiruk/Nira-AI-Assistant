// Slash-command registry: model-independent shortcuts that call tools directly
// via POST /tools/run (no LLM needed). Each command maps to a backend tool and
// extracts its arguments from the text after the command.

export const SLASH_COMMANDS = [
  { cmd: 'browse', tool: 'tavily_search', icon: '🧭', label: 'Browse the web (Tavily)',
    hint: 'e.g. /browse latest AI news', arg: (t) => ({ query: t, search_depth: 'advanced' }) },
  { cmd: 'search', tool: 'tavily_search', icon: '🔍', label: 'Web search (Tavily)',
    hint: 'e.g. /search python tips', arg: (t) => ({ query: t, search_depth: 'basic' }) },
  { cmd: 'pubmed', tool: 'pubmed_search', icon: '🧬', label: 'Search PubMed (research)',
    hint: 'e.g. /pubmed CRISPR therapy', arg: (t) => ({ query: t, max_results: 5 }) },
  { cmd: 'research', tool: 'pubmed_search', icon: '🧬', label: 'Research on PubMed',
    hint: 'e.g. /research mRNA vaccine', arg: (t) => ({ query: t, max_results: 5 }) },
  { cmd: 'wiki', tool: 'wikipedia', icon: '📚', label: 'Wikipedia summary',
    hint: 'e.g. /wiki black holes', arg: (t) => ({ query: t }) },
  { cmd: 'youtube', tool: 'youtube_search', icon: '▶️', label: 'Search YouTube',
    hint: 'e.g. /youtube lo-fi beats', arg: (t) => ({ query: t }) },
  { cmd: 'github', tool: 'github_search', icon: '🐙', label: 'Search GitHub',
    hint: 'e.g. /github transformers', arg: (t) => ({ query: t }) },
  { cmd: 'arxiv', tool: 'arxiv_search', icon: '📄', label: 'Search arXiv',
    hint: 'e.g. /arxiv diffusion models', arg: (t) => ({ query: t }) },
  { cmd: 'reddit', tool: 'reddit_search', icon: '👽', label: 'Search Reddit',
    hint: 'e.g. /reddit selfhosted', arg: (t) => ({ query: t }) },
  { cmd: 'x', tool: 'social_search', icon: '𝕏', label: 'Search X / Twitter',
    hint: 'e.g. /x openai', arg: (t) => ({ query: t }) },
  { cmd: 'weather', tool: 'get_weather', icon: '🌤', label: 'Get weather',
    hint: 'e.g. /weather Addis Ababa', arg: (t) => ({ location: t || 'Addis Ababa' }) },
  { cmd: 'calc', tool: 'calculate', icon: '🧮', label: 'Calculate',
    hint: 'e.g. /calc 1234*5678', arg: (t) => ({ expression: t }) },
  { cmd: 'open', tool: 'open_browser', icon: '🌐', label: 'Open URL in browser',
    hint: 'e.g. /open https://nira.ai', arg: (t) => ({ url: t }) },
  { cmd: 'shot', tool: 'take_screenshot', icon: '📸', label: 'Screenshot window',
    hint: '/shot', arg: () => ({}) },
  { cmd: 'help', tool: '__help__', icon: '❓', label: 'List all commands',
    hint: '/help', arg: () => ({}) },
]

export const SLASH_MAP = Object.fromEntries(SLASH_COMMANDS.map((c) => [c.cmd, c]))

// Parse a raw input string. Returns { command, rest, def } or null if not a slash cmd.
export function parseSlash(input) {
  if (!input || !input.startsWith('/')) return null
  const body = input.slice(1).trim()
  const sp = body.indexOf(' ')
  const name = (sp === -1 ? body : body.slice(0, sp)).toLowerCase()
  const rest = sp === -1 ? '' : body.slice(sp + 1).trim()
  const def = SLASH_MAP[name]
  if (!def) return { unknown: name }
  return { command: name, rest, def }
}
