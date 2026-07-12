# OAuth Integrations — Setup & Deployment (GitHub + Spotify)

NIRA now supports **OAuth 2.0 Authorization Code** flow for integrations. Tokens
are stored **encrypted at rest** in MongoDB (`nira_oauth` DB) per user and are
**never** exposed to the frontend. This document covers the first two services
(GitHub, Spotify). Google/Reddit/X follow the same pattern later.

## What the user sees
- Settings → Tool Connections shows GitHub and Spotify as **Connect / Disconnect**
  cards with a live Connected status.
- Clicking **Connect** redirects to the provider's consent screen, then back to
  the Integrations UI (`?connected=github`) with a success message.
- Key-based tools (Google, Translate, YouTube, Reddit, X, Email, Clipboard) keep
  the manual key input.

## Required environment variables (backend, never committed)
Set these in Render's env vars (or a local `.env`, which is git-ignored):

```
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/nira_oauth
TOKEN_ENCRYPTION_KEY=<fernet key>      # python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
OAUTH_REDIRECT_BASE=https://<your-backend>.onrender.com   # backend public origin
WEB_ORIGIN=https://nira-ai-assistant.vercel.app            # frontend origin (CORS)
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

> If `TOKEN_ENCRYPTION_KEY` is missing, NIRA **refuses to store tokens** (fail
> closed) rather than writing them in plaintext. If `MONGODB_URI` is missing,
> the OAuth status endpoints report "unavailable" and the tools fall back to
> env/legacy keys.

## Redirect URI to register with each provider
Register **exactly** this callback per service (same pattern for all):

```
https://<your-backend>.onrender.com/auth/{service}/callback
```

i.e.
- GitHub:  `https://<your-backend>.onrender.com/auth/github/callback`
- Spotify: `https://<your-backend>.onrender.com/auth/spotify/callback`

(If you don't set `OAUTH_REDIRECT_BASE`, NIRA derives it from Render's
`RENDER_EXTERNAL_URL`.)

## Provider app setup
- **GitHub** — github.com/settings/developers → New OAuth App.
  - Homepage URL: your frontend (https://nira-ai-assistant.vercel.app)
  - Authorization callback URL: the GitHub line above.
  - Scopes requested (minimal): `read:user`, `repo`.
- **Spotify** — developer.spotify.com/dashboard → app → Settings.
  - Redirect URI: the Spotify line above.
  - Scopes requested (minimal): `user-read-playback-state`, `user-read-currently-playing`.
  - Spotify returns a refresh token (offline access) — NIRA stores and rotates it.

## Security checklist (implemented)
- ✅ `state` param generated per login, stored in an **httpOnly** cookie, validated
  on callback via constant-time compare (CSRF protection).
- ✅ Tokens encrypted at rest (Fernet); client secrets live only in backend env vars.
- ✅ Tokens are never logged; a `_redact` helper exists for safe diagnostics.
- ✅ `config/tool_keys.json` and `.env` are git-ignored.
- ✅ Minimal scopes; GitHub refreshable=false (token lives until revoke), Spotify
  refresh handled server-side before each call when expired.

## Migration from tool_keys.json
Only key-based services (Translate, Weather, etc.) keep `tool_keys.json`. GitHub
and Spotify no longer need a pasted token — connect via OAuth instead. No data
migration is required: old `spotify`/`github` entries in `tool_keys.json` are
simply ignored in favor of the encrypted OAuth token (which takes priority).
If you previously stored a manual Spotify token there, it still works as a
fallback, but connecting via OAuth supersedes it.

## Testing (manual, by you)
1. Deploy with the env vars above.
2. In Settings → Tool Connections, click **Connect** on GitHub and Spotify.
3. Authorize on each provider; you return to the UI with "Connected to github".
4. Ask NIRA to search GitHub / search Spotify — it now uses your per-user token.
5. Click **Disconnect** → status returns to Not connected.
