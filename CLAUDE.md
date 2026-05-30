# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
npm run build          # compile TypeScript → dist/
npm run inspector      # open MCP Inspector UI against the built server
```

**Run the server:**
```bash
# stdio mode (for Claude Desktop / MCP clients)
TRELLO_API_KEY=x TRELLO_TOKEN=x node dist/index.js

# HTTP mode (REST API + dashboard at http://127.0.0.1:3000)
TRANSPORT=http TRELLO_API_KEY=x TRELLO_TOKEN=x node dist/index.js

# Load from .env
set -a && source .env && set +a && node dist/index.js
```

**Python agent (Ollama):**
```bash
pip install -r client/requirements.txt
OLLAMA_MODEL=llama3.1 python client/agent.py
```

There are no tests. Verify changes by running the server and hitting endpoints with curl or the dashboard API Tester.

---

## Architecture

### Two transports, one server

`src/index.ts` selects the transport from `TRANSPORT` env var:

- **`stdio`** (default) — MCP only. `StdioServerTransport` from the SDK. Used by Claude Desktop, Cursor, Continue.dev. No HTTP server starts.
- **`http`** — Express server on port 3000. Exposes `/mcp` (StreamableHTTP), `/api/*` (REST), and `/dashboard` (HTML). `createServer()` is called fresh **per MCP request** (stateless).

### Credential flow

`src/services/credentials.ts` is the single source of truth for auth. Priority:

1. `TRELLO_API_KEY` / `TRELLO_TOKEN` env vars
2. `~/.trello-mcp/credentials.json` (written by the dashboard GUI, mode 0600)
3. Empty → server starts but all Trello API calls return 401

`src/services/api-client.ts` calls `getCredentials()` on **every request** (not at module load), so GUI saves take effect immediately without restarting. The credential cache in `credentials.ts` is invalidated on `saveCredentials()`.

### Tool registration

Each domain file exports `registerXxxTools(server: McpServer)`. `index.ts` calls all three:

```
tools/boards.ts  → registerBoardTools   (get_me, list_boards, get_board, search)
tools/lists.ts   → registerListTools    (get_list_cards, create_list, archive_list)
tools/cards.ts   → registerCardTools    (get/create/update/move/archive/delete, comments)
```

To add a new domain: create `tools/mytool.ts` → export `registerMyTools(server)` → import and call in `index.ts`.

### Tool anatomy

Every `server.registerTool(name, schema, handler)` call follows this pattern:

```typescript
server.registerTool("trello_verb_noun", {
  title: "...",
  description: `Multi-line description with arg docs and examples.`,
  inputSchema: { id: IdSchema, name: z.string().min(1).max(200) },
  annotations: { readOnlyHint: true/false, destructiveHint: true/false, ... },
}, async ({ id, name }) => {
  try {
    const data = await get<T>(`/resource/${sanitizePath(id)}`);
    return jsonResponse(data as unknown as Record<string, unknown>);
  } catch (err) {
    const e = err as { status?: number; message: string };
    if (e.status === 404) return notFoundResponse("Resource", id);
    return errorResponse(e.message);
  }
});
```

- Always call `sanitizePath()` on user-supplied ID segments before interpolating into URLs.
- Use `jsonResponse()` for structured data, `errorResponse()` for failures, `notFoundResponse()` for 404s.
- Tool handlers must **never throw** — always return a `ToolResponse`.

### REST routes mirror MCP tools

`src/routes/rest.ts` exposes the same Trello operations as HTTP endpoints. Both use the same `get/post/put/del` helpers from `api-client.ts`. When adding a new MCP tool, add the equivalent REST route too.

### Analytics middleware

`src/middleware/analytics.ts` records every non-internal request to the in-memory `MetricsService` **and** appends a JSON line to `logs/server.log`. Internal paths (`/health`, `/dashboard`, `/api/metrics*`) are skipped. The logger rotates `server.log` → `server.log.1` at 10 MB on startup.

### ESM / import rules

`package.json` has `"type": "module"`. All imports must use `.js` extensions even for `.ts` source files (TypeScript ESM requirement). `moduleResolution: "bundler"` in `tsconfig.json`.

---

## Key constraints

- **No `API_KEY`/`API_TOKEN` in constants.ts** — they were removed. Auth lives entirely in `credentials.ts`.
- **`BIND_HOST` defaults to `127.0.0.1`** — never `0.0.0.0` without an explicit override. The Origin header check in `runHTTP()` enforces this at the application layer too.
- **MCP tool names** follow `trello_verb_noun` — keep consistent with existing 15 tools.
- **Zod schemas** for all REST body inputs — use `safeParse` and return 400 on failure.
- **`IdSchema`** (`schemas/common.ts`) validates alphanumeric + hyphens/underscores only — use it for every path parameter coming from user input.
