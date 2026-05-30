#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, io
# Force UTF-8 on Windows so Unicode tool symbols print correctly
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
"""
Trello Agent — Ollama client for the Trello MCP REST server.

Security model
--------------
This client holds ZERO Trello credentials.
All auth (TRELLO_API_KEY / TRELLO_TOKEN) stays on the MCP server.
The client only calls http://127.0.0.1:3000/api/* — never Trello directly.

Quick start
-----------
  pip install -r requirements.txt

  # 1. Start the MCP server (in another terminal)
  TRANSPORT=http node dist/index.js

  # 2. Run the agent
  python client/agent.py

  # Override model or server URL
  OLLAMA_MODEL=qwen2.5 MCP_SERVER_URL=http://127.0.0.1:3000 python client/agent.py

Recommended models (tool-calling capable)
------------------------------------------
  ollama pull llama3.1        # best overall
  ollama pull qwen2.5         # fast + accurate tools
  ollama pull llama3.2        # lighter, still works
"""

import json
import os
import sys
from typing import Any

import ollama
import requests

# ── Config ────────────────────────────────────────────────────────────────────
SERVER_URL = os.environ.get("MCP_SERVER_URL", "http://127.0.0.1:3000").rstrip("/")
MODEL      = os.environ.get("OLLAMA_MODEL",   "llama3.1")
TIMEOUT    = int(os.environ.get("REQUEST_TIMEOUT", "15"))

# ── Tool definitions (OpenAI / Ollama function-calling format) ────────────────
# These mirror the 13 MCP tools on the server.
# Descriptions are what the LLM reads — be precise so it picks the right tool.
TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "get_me",
            "description": "Get the authenticated Trello user's profile and all their boards.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_boards",
            "description": "List Trello boards for the current user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filter": {
                        "type": "string",
                        "enum": ["open", "closed", "all"],
                        "description": "Which boards to return (default: open)",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_board",
            "description": (
                "Get a board's name, description, URL, and all its open lists (columns). "
                "Call this before creating cards so you know which list ID to use."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Board ID"}
                },
                "required": ["id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_list_cards",
            "description": "Get all cards inside a specific Trello list (column).",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "List ID"},
                    "filter": {
                        "type": "string",
                        "enum": ["open", "closed", "all"],
                        "description": "Card state filter (default: open)",
                    },
                },
                "required": ["id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_card",
            "description": "Get full details of a single Trello card by its ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Card ID"}
                },
                "required": ["id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_card",
            "description": "Create a new card in a Trello list.",
            "parameters": {
                "type": "object",
                "properties": {
                    "idList": {"type": "string", "description": "List ID to add the card to"},
                    "name":   {"type": "string", "description": "Card title"},
                    "desc":   {"type": "string", "description": "Card description (Markdown supported)"},
                    "due":    {"type": "string", "description": "Due date in ISO 8601 e.g. 2025-06-30T09:00:00Z"},
                    "pos":    {"type": "string", "enum": ["top", "bottom"]},
                },
                "required": ["idList", "name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_card",
            "description": (
                "Update an existing Trello card. Can rename, change description, "
                "set or remove due date, mark due complete, move to a different list, or archive."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "id":          {"type": "string",  "description": "Card ID"},
                    "name":        {"type": "string",  "description": "New card title"},
                    "desc":        {"type": "string",  "description": "New description"},
                    "due":         {"type": "string",  "description": "ISO 8601 date, or empty string to remove due date"},
                    "dueComplete": {"type": "boolean", "description": "Mark due date complete/incomplete"},
                    "idList":      {"type": "string",  "description": "Move card to this list ID"},
                    "closed":      {"type": "boolean", "description": "true to archive, false to restore"},
                },
                "required": ["id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_list",
            "description": "Create a new list (column) on a Trello board.",
            "parameters": {
                "type": "object",
                "properties": {
                    "idBoard": {"type": "string", "description": "Board ID"},
                    "name":    {"type": "string", "description": "List name"},
                    "pos":     {"type": "string", "enum": ["top", "bottom"]},
                },
                "required": ["idBoard", "name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_card",
            "description": (
                "Permanently delete a Trello card. This cannot be undone. "
                "Prefer update_card with closed=true to archive instead."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Card ID"}
                },
                "required": ["id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_comment",
            "description": "Add a comment to a Trello card.",
            "parameters": {
                "type": "object",
                "properties": {
                    "id":   {"type": "string", "description": "Card ID"},
                    "text": {"type": "string", "description": "Comment text (Markdown supported)"},
                },
                "required": ["id", "text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_trello",
            "description": "Search across all Trello boards and cards by keyword.",
            "parameters": {
                "type": "object",
                "properties": {
                    "q":            {"type": "string",  "description": "Search query"},
                    "cards_limit":  {"type": "integer", "description": "Max cards to return (default 10)"},
                    "boards_limit": {"type": "integer", "description": "Max boards to return (default 5)"},
                },
                "required": ["q"],
            },
        },
    },
]

# ── Dispatch table ────────────────────────────────────────────────────────────
# Maps tool name → (HTTP method, path template, [path param names])
# Path params are extracted from args and substituted into the URL.
# Remaining args become query params (GET) or request body (POST/PUT).
ROUTES: dict[str, tuple[str, str, list[str]]] = {
    "get_me":         ("GET",    "/api/me",                    []),
    "list_boards":    ("GET",    "/api/boards",                []),
    "get_board":      ("GET",    "/api/boards/{id}",           ["id"]),
    "get_list_cards": ("GET",    "/api/lists/{id}/cards",      ["id"]),
    "get_card":       ("GET",    "/api/cards/{id}",            ["id"]),
    "create_card":    ("POST",   "/api/cards",                 []),
    "update_card":    ("PUT",    "/api/cards/{id}",            ["id"]),
    "create_list":    ("POST",   "/api/lists",                 []),
    "delete_card":    ("DELETE", "/api/cards/{id}",            ["id"]),
    "add_comment":    ("POST",   "/api/cards/{id}/comments",   ["id"]),
    "search_trello":  ("GET",    "/api/search",                []),
}


def call_tool(name: str, args: dict[str, Any]) -> Any:
    """
    Route a tool call to the MCP REST server and return the parsed JSON response.
    Never raises — always returns a dict (may contain an 'error' key).
    """
    if name not in ROUTES:
        return {"error": f"Unknown tool: {name}"}

    method, path_tpl, path_params = ROUTES[name]

    # Substitute path parameters
    url  = SERVER_URL + path_tpl
    rest = dict(args)
    for param in path_params:
        url = url.replace("{" + param + "}", str(rest.pop(param, "")))

    try:
        if method == "GET":
            r = requests.get(url, params=rest, timeout=TIMEOUT)
        elif method == "POST":
            r = requests.post(url, json=rest, timeout=TIMEOUT)
        elif method == "PUT":
            r = requests.put(url, json=rest, timeout=TIMEOUT)
        elif method == "DELETE":
            r = requests.delete(url, timeout=TIMEOUT)
        else:
            return {"error": f"Unhandled HTTP method: {method}"}

        if not r.content:
            return {"status": r.status_code}
        return r.json()

    except requests.Timeout:
        return {"error": f"MCP server timed out after {TIMEOUT}s"}
    except requests.ConnectionError:
        return {"error": f"Cannot reach MCP server at {SERVER_URL} — is it running?"}
    except Exception as exc:  # noqa: BLE001
        return {"error": str(exc)}


# ── System prompt ─────────────────────────────────────────────────────────────
SYSTEM = """You are a Trello assistant with access to tools for managing boards, lists, and cards.

Rules:
- Never guess board, list, or card IDs. Use get_me or list_boards first, then get_board to see lists.
- When the user asks to "move" a card, use update_card with the idList parameter.
- Prefer update_card with closed=true over delete_card unless the user explicitly says delete.
- Chain tool calls without asking the user for intermediate IDs they don't know.
- Keep final answers short — describe what was done, not every API response."""


# ── Agent loop ────────────────────────────────────────────────────────────────

def run_turn(user_message: str, history: list[dict]) -> tuple[str, list[dict]]:
    """
    Run one conversational turn. Returns (answer, updated_history).
    Loops internally until the model stops calling tools.
    """
    messages = history + [{"role": "user", "content": user_message}]

    while True:
        response = ollama.chat(model=MODEL, messages=messages, tools=TOOLS)
        msg      = response["message"]
        messages.append(msg)

        calls = msg.get("tool_calls") or []
        if not calls:
            return msg.get("content", ""), messages

        for call in calls:
            fn   = call["function"]
            name = fn["name"]
            # Arguments may arrive as a dict or a JSON string depending on the model
            raw_args = fn.get("arguments") or {}
            args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args

            print(f"  ⚙  {name}({_fmt(args)})", flush=True)
            result = call_tool(name, args)
            short  = json.dumps(result, separators=(",", ":"))
            print(f"  ↩  {short[:140]}{'…' if len(short) > 140 else ''}", flush=True)

            messages.append({"role": "tool", "content": json.dumps(result)})


def _fmt(d: dict) -> str:
    return ", ".join(f"{k}={json.dumps(v)}" for k, v in d.items())


# ── Health check ──────────────────────────────────────────────────────────────

def check_server() -> bool:
    try:
        return requests.get(f"{SERVER_URL}/health", timeout=5).ok
    except Exception:
        return False


def check_ollama() -> bool:
    try:
        ollama.list()
        return True
    except Exception:
        return False


# ── REPL ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print(f"\nTrello Agent  model={MODEL}  server={SERVER_URL}")
    print("─" * 50)

    ok = True
    if not check_ollama():
        print("ERROR: Ollama not running — start it with:  ollama serve")
        ok = False
    if not check_server():
        print(f"ERROR: MCP server not reachable at {SERVER_URL}")
        print("       Start it with:  TRANSPORT=http node dist/index.js")
        ok = False
    if not ok:
        sys.exit(1)

    print("Type your request. 'exit' or Ctrl+C to quit.\n")

    history: list[dict] = [{"role": "system", "content": SYSTEM}]

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye.")
            break

        if not user_input:
            continue
        if user_input.lower() in {"exit", "quit", "bye"}:
            break

        try:
            answer, history = run_turn(user_input, history)
            print(f"\nAgent: {answer}\n")
        except ollama.ResponseError as exc:
            print(f"Ollama error: {exc}\n")


if __name__ == "__main__":
    main()
