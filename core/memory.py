"""
SQLite-backed memory for JARVIS (MVP).

Two stores:
  * ``conversations`` — rolling chat history, scoped by ``session``.
  * ``prefs``        — key/value user preferences (name, favorites, etc.).

The storage backend is intentionally swappable: this module is the only
place that knows about SQLite. Later versions can add a ChromaDB-backed
semantic store behind the same interface.
"""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_DB = Path(__file__).resolve().parent.parent / "database" / "memory.db"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Memory:
    def __init__(self, db_path: str | Path = DEFAULT_DB) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _conn(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def _init_db(self) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS conversations (
                    id       INTEGER PRIMARY KEY AUTOINCREMENT,
                    session  TEXT NOT NULL,
                    role     TEXT NOT NULL,
                    content  TEXT NOT NULL,
                    ts       TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS prefs (
                    key   TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    sid    TEXT PRIMARY KEY,
                    title  TEXT NOT NULL,
                    created TEXT NOT NULL,
                    updated TEXT NOT NULL
                )
                """
            )

    # --- conversation history -------------------------------------------------

    def save_message(self, session: str, role: str, content: str) -> None:
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO conversations (session, role, content, ts) VALUES (?, ?, ?, ?)",
                (session, role, content, _now()),
            )

    def get_history(self, session: str, limit: int = 50) -> list[dict[str, str]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT role, content FROM conversations "
                "WHERE session = ? ORDER BY id DESC LIMIT ?",
                (session, limit),
            ).fetchall()
        rows.reverse()
        return [{"role": role, "content": content} for role, content in rows]

    def clear_history(self, session: str) -> None:
        with self._conn() as conn:
            conn.execute("DELETE FROM conversations WHERE session = ?", (session,))

    # --- preferences -----------------------------------------------------------

    def set_pref(self, key: str, value: str) -> None:
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO prefs (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, value),
            )

    def get_pref(self, key: str, default: str | None = None) -> str | None:
        with self._conn() as conn:
            row = conn.execute("SELECT value FROM prefs WHERE key = ?", (key,)).fetchone()
        return row[0] if row else default

    # --- sessions --------------------------------------------------------------

    def ensure_session(self, sid: str, title: str | None = None) -> None:
        """Create a session row if absent. Title defaults to 'New chat'."""
        with self._conn() as conn:
            row = conn.execute("SELECT sid FROM sessions WHERE sid = ?", (sid,)).fetchone()
            if not row:
                now = _now()
                conn.execute(
                    "INSERT INTO sessions (sid, title, created, updated) VALUES (?, ?, ?, ?)",
                    (sid, title or "New chat", now, now),
                )

    def touch_session(self, sid: str, title: str | None = None) -> None:
        """Update a session's last-active time (and title if given)."""
        with self._conn() as conn:
            if title is not None:
                conn.execute(
                    "UPDATE sessions SET title = ?, updated = ? WHERE sid = ?",
                    (title, _now(), sid),
                )
            else:
                conn.execute("UPDATE sessions SET updated = ? WHERE sid = ?", (_now(), sid))

    def rename_session(self, sid: str, title: str) -> None:
        with self._conn() as conn:
            conn.execute(
                "UPDATE sessions SET title = ? WHERE sid = ?",
                (title.strip()[:120] or "New chat", sid),
            )

    def delete_session(self, sid: str) -> None:
        with self._conn() as conn:
            conn.execute("DELETE FROM sessions WHERE sid = ?", (sid,))
            conn.execute("DELETE FROM conversations WHERE session = ?", (sid,))

    def list_sessions(self) -> list[dict[str, str]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT sid, title, created, updated FROM sessions ORDER BY updated DESC"
            ).fetchall()
        return [
            {"sid": r[0], "title": r[1], "created": r[2], "updated": r[3]}
            for r in rows
        ]
