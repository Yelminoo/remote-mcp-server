# Trello MCP Server

A production-ready MCP server for Trello — works with Claude Desktop, Cursor, Continue.dev, and any Ollama-compatible LLM via the built-in REST API.

---

## Project Structure

```
mcp-template/
├── src/
│   ├── index.ts                    ← entry point — stdio + HTTP transport setup
│   ├── constants.ts                ← service name, base URL, limits
│   ├── types.ts                    ← shared TypeScript interfaces
│   │
│   ├── services/
│   │   ├── api-client.ts           ← axios HTTP client — injects auth per request
│   │   ├── credentials.ts          ← credential store (env → file → none)
│   │   ├── formatter.ts            ← shared MCP response formatters
│   │   ├── logger.ts               ← JSON logger → logs/server.log (NDJSON)
│   │   └── metrics.ts              ← in-memory request metrics
│   │
│   ├── middleware/
│   │   └── analytics.ts            ← Express middleware — records every request
│   │
│   ├── schemas/
│   │   └── common.ts               ← reusable Zod schemas (pagination, IDs, etc.)
│   │
│   ├── tools/                      ← MCP tools (13 total)
│   │   ├── boards.ts               ← get_me, list_boards, get_board, search
│   │   ├── lists.ts                ← get_list_cards, create_list, archive_list
│   │   └── cards.ts                ← get/create/update/move/archive/delete card, comments
│   │
│   └── routes/
│       ├── rest.ts                 ← REST API + credential endpoints
│       └── dashboard.ts            ← analytics dashboard + API tester (HTML)
│
├── client/
│   ├── agent.py                    ← Ollama agent (tool loop + REPL)
│   └── requirements.txt            ← ollama, requests
│
├── logs/
│   └── server.log                  ← NDJSON request log (auto-rotates at 10 MB)
│
├── dist/                           ← compiled output (git-ignored)
├── .env                            ← local env vars (git-ignored)
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## Quick Start

### 1. Install and build

```bash
npm install
npm run build
```

### 2. Get Trello credentials

1. Go to <https://trello.com/app-key>
2. Copy your **API Key**
3. Click **"Generate a token"** — copy the token

### 3. Start in HTTP mode and configure via dashboard

```bash
TRANSPORT=http node dist/index.js
```

Open <http://127.0.0.1:3000/dashboard> → click **⚙** → paste your key and token → **Test connection** → **Save**.

Credentials are saved to `~/.trello-mcp/credentials.json` (mode `0600`, outside the repo).

### 4. Or set credentials via environment variables

```bash
# .env
TRELLO_API_KEY=your_32_char_key
TRELLO_TOKEN=your_64_char_token
TRANSPORT=http
PORT=3000
```

```bash
set -a && source .env && set +a && node dist/index.js
```

---

## MCP Tools (13)

All tools are available over both stdio and HTTP transports.

| Tool | Description |
|------|-------------|
| `trello_get_me` | Get authenticated member profile + boards |
| `trello_list_boards` | List boards (filter: open / closed / all) |
| `trello_get_board` | Get board details + open lists |
| `trello_search` | Search cards and boards by keyword |
| `trello_get_list_cards` | Get cards in a list |
| `trello_create_list` | Create a new list on a board |
| `trello_archive_list` | Archive a list |
| `trello_get_card` | Get full card details |
| `trello_create_card` | Create a card (name, desc, due, pos) |
| `trello_update_card` | Update any card field |
| `trello_move_card` | Move card to a different list / board |
| `trello_archive_card` | Archive a card (reversible) |
| `trello_delete_card` | Permanently delete a card |
| `trello_add_comment` | Add a comment to a card |
| `trello_get_card_comments` | Get comments on a card |

---

## REST API

All endpoints live under `http://127.0.0.1:3000/api/` (HTTP mode only).

### Trello

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/me` | Current member profile |
| `GET` | `/api/boards?filter=open` | List boards |
| `GET` | `/api/boards/:id` | Get board + lists |
| `GET` | `/api/boards/:id/lists` | Lists on a board |
| `GET` | `/api/boards/:id/cards` | All cards on a board |
| `GET` | `/api/lists/:id/cards` | Cards in a list |
| `POST` | `/api/lists` | Create list `{ idBoard, name, pos }` |
| `PUT` | `/api/lists/:id` | Update list `{ name?, closed? }` |
| `GET` | `/api/cards/:id` | Get card |
| `POST` | `/api/cards` | Create card `{ idList, name, desc?, due?, pos? }` |
| `PUT` | `/api/cards/:id` | Update card (any field) |
| `DELETE` | `/api/cards/:id` | Delete card |
| `POST` | `/api/cards/:id/comments` | Add comment `{ text }` |
| `GET` | `/api/search?q=...` | Search cards + boards |

### Credentials (local — never exposes real values)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/credentials/status` | Masked status + source (env / file / none) |
| `POST` | `/api/credentials` | Save `{ apiKey, apiToken }` to `~/.trello-mcp/credentials.json` |
| `GET` | `/api/credentials/test` | Live Trello connection test |

### Analytics

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/metrics` | Aggregate stats snapshot |
| `GET` | `/api/metrics/recent?n=50` | Last N request records |

---

## Dashboard

Open <http://127.0.0.1:3000/dashboard> in HTTP mode.

- **⚙ Credentials panel** — set/test/update Trello credentials without restarting the server
- **Stat cards** — total requests, error rate, avg latency, uptime
- **Endpoints panel** — per-route call count with visual bars
- **Recent requests table** — last 30 requests with status, method, latency
- **API Tester** — every REST endpoint is expandable with live form fields — fill params and click **Send** to see the real JSON response inline

---

## Transport Modes

| Mode | Command | What's available |
|------|---------|-----------------|
| **stdio** (default) | `node dist/index.js` | MCP tools only |
| **HTTP** | `TRANSPORT=http node dist/index.js` | MCP + REST + dashboard + logging |

Claude Desktop and most MCP clients use stdio. The HTTP mode is for the dashboard, the Ollama agent, and any HTTP-based tool caller.

---

## Claude Desktop Setup

Add to `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "trello": {
      "command": "node",
      "args": ["C:\\Users\\User\\Github Project\\MCP Server\\mcp-template\\dist\\index.js"],
      "env": {
        "TRELLO_API_KEY": "your_key",
        "TRELLO_TOKEN": "your_token"
      }
    }
  }
}
```

> If you already saved credentials via the dashboard, drop the `"env"` block — the server reads `~/.trello-mcp/credentials.json` automatically.

Restart Claude Desktop. Look for the 🔌 icon — then ask: *"Show me my Trello boards."*

---

## Ollama Agent

For Ollama and any OpenAI-compatible LLM — the Python agent calls the REST API on the model's behalf.

**Requirements:** Ollama running with a tool-capable model

```bash
ollama pull llama3.1     # recommended
# or: ollama pull qwen2.5 / llama3.2
```

**Install and run:**

```bash
cd mcp-template
pip install -r client/requirements.txt

# Terminal 1 — MCP server
TRANSPORT=http node dist/index.js

# Terminal 2 — agent REPL
python client/agent.py
```

**Environment variables:**

```bash
OLLAMA_MODEL=llama3.1            # default
MCP_SERVER_URL=http://127.0.0.1:3000   # default
REQUEST_TIMEOUT=15               # seconds
```

**Example session:**

```
You: Show me all my boards
  >> get_me()
  <- {"username":"mike",...}
Agent: You have 45 boards. Here are the open ones: AI, Heyoka Production, ...

You: Create a card "Fix login bug" in the To Do list on the AI board
  >> get_board(id="63faeffae75800254e5f8453")
  << {"lists":[{"id":"abc","name":"To Do"},...]}
  >> create_card(idList="abc", name="Fix login bug")
  << {"id":"card123","shortUrl":"https://trello.com/c/..."}
Agent: Created "Fix login bug" in To Do. https://trello.com/c/...
```

---

## Security Model

```
LLM / client
    │  sees: tool schemas + descriptions only
    │  never sees: Trello credentials
    ▼
MCP server  (127.0.0.1:3000)
    │  holds: ~/.trello-mcp/credentials.json  (mode 0600, outside repo)
    │  reads: TRELLO_API_KEY / TRELLO_TOKEN from env (env takes priority)
    │  calls: https://api.trello.com/1/...?key=...&token=...
    ▼
Trello API
```

- Credentials stored in the **home directory**, never the repo
- API responses return **masked values only** (`abcd••••••••efgh`) — full credentials never leave the server process
- Server binds to **127.0.0.1 only** by default (`BIND_HOST=0.0.0.0` to expose — do intentionally)
- **Origin header check** blocks browser-based CSRF from non-localhost origins
- Credentials injected **per-request** from the service — updating via GUI takes effect immediately, no restart

---

## Logging

Requests are logged to `logs/server.log` in **NDJSON format** (one JSON object per line).

```json
{"ts":"2026-05-30T07:56:40.431Z","level":"info","service":"trello","msg":"request","method":"GET","path":"/me","status":200,"durationMs":720}
{"ts":"2026-05-30T07:56:41.332Z","level":"info","service":"trello","msg":"request","method":"GET","path":"/boards","status":200,"durationMs":555}
```

- `info` for 2xx/3xx, `warn` for 4xx, `error` for 5xx
- Rotates automatically when the file exceeds **10 MB** (`server.log` → `server.log.1`)
- The `logs/` directory is git-ignored
- Parse with `jq`: `cat logs/server.log | jq 'select(.status >= 400)'`

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TRELLO_API_KEY` | Yes* | — | Trello API key from trello.com/app-key |
| `TRELLO_TOKEN` | Yes* | — | Trello OAuth token |
| `TRANSPORT` | No | `stdio` | `stdio` or `http` |
| `PORT` | No | `3000` | HTTP server port |
| `BIND_HOST` | No | `127.0.0.1` | Network interface to bind |
| `API_BASE_URL` | No | `https://api.trello.com/1` | Override Trello base URL |
| `REQUEST_TIMEOUT` | No | `15` | Trello API timeout in seconds |

*\* Or set via dashboard GUI — saved to `~/.trello-mcp/credentials.json`.*
