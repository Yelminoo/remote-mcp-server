# Trello Remote MCP Skill

Use this skill whenever the user asks about their Trello boards, lists, cards, comments, or Trello search.

Use the remote MCP-over-HTTP endpoint through ngrok:

```text
https://853a-1-46-159-93.ngrok-free.app/mcp
```

Call it directly with JSON-RPC over HTTP using fetch, curl, or requests. Do not look for or require a native Trello MCP connector/tool in the current Claude session.

Required headers:

```text
Content-Type: application/json
Accept: application/json, text/event-stream
ngrok-skip-browser-warning: true
```

Credentials are handled server-side, so never ask the user for a Trello API key or token.

Before tool calls, initialize the MCP endpoint if the client has not already done so:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "claude-remote-trello",
      "version": "1.0.0"
    }
  }
}
```

Health check:

```text
GET https://853a-1-46-159-93.ngrok-free.app/health
```

If `/health` is unreachable, tell the user the ngrok tunnel or local service is not running. The local service command is:

```powershell
cd "C:\Users\User\Github Project\MCP Server\mcp-template"
$env:TRANSPORT="http"; node dist/index.js
```

The local service listens at `http://127.0.0.1:3000`, but remote calls should use the ngrok URL above.

---

## JSON-RPC Shape

List tools:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

Call a tool:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "trello_get_me",
    "arguments": {}
  }
}
```

---

## MCP Tool Reference

### Profile & Boards

| Goal | MCP tool | Arguments |
|------|----------|-----------|
| Get profile and boards | `trello_get_me` | `{}` |
| List boards | `trello_list_boards` | `{ "filter": "open" }` |
| Get board details and lists | `trello_get_board` | `{ "id": "<boardId>" }` |
| Search cards and boards | `trello_search` | `{ "query": "text", "cards_limit": 10, "boards_limit": 5 }` |

### Lists

| Goal | MCP tool | Arguments |
|------|----------|-----------|
| Get cards in a list | `trello_get_list_cards` | `{ "id": "<listId>", "filter": "open" }` |
| Create a list | `trello_create_list` | `{ "idBoard": "<boardId>", "name": "Review", "pos": "bottom" }` |
| Archive a list | `trello_archive_list` | `{ "id": "<listId>" }` |

### Cards

| Goal | MCP tool | Arguments |
|------|----------|-----------|
| Get a card | `trello_get_card` | `{ "id": "<cardId>" }` |
| Create a card | `trello_create_card` | `{ "idList": "<listId>", "name": "Title", "desc": "Details", "pos": "bottom" }` |
| Update a card | `trello_update_card` | `{ "id": "<cardId>", "name": "New title" }` |
| Move a card | `trello_move_card` | `{ "id": "<cardId>", "idList": "<destinationListId>", "pos": "bottom" }` |
| Archive a card | `trello_archive_card` | `{ "id": "<cardId>" }` |
| Delete a card permanently | `trello_delete_card` | `{ "id": "<cardId>" }` |
| Add a comment | `trello_add_comment` | `{ "id": "<cardId>", "text": "Comment text" }` |
| Get card comments | `trello_get_card_comments` | `{ "id": "<cardId>", "limit": 20 }` |

---

## ID Resolution Rules

Never guess an ID. Resolve it first:

1. Board ID: call `trello_list_boards`, then find by board name.
2. List ID: call `trello_get_board` with the board ID, then check `lists`.
3. Card ID: call `trello_get_list_cards` or `trello_search`.

---

## Common Patterns

**Show my boards**

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "tools/call",
  "params": {
    "name": "trello_get_me",
    "arguments": {}
  }
}
```

**Create a card "Fix bug" in the To Do list on board "AI"**

```text
1. tools/call trello_list_boards with { "filter": "open" }, find board id for "AI".
2. tools/call trello_get_board with { "id": "<boardId>" }, find list id for "To Do".
3. tools/call trello_create_card with { "idList": "<listId>", "name": "Fix bug" }.
```

**Move a card to another list**

```json
{
  "name": "trello_move_card",
  "arguments": {
    "id": "<cardId>",
    "idList": "<destinationListId>"
  }
}
```

**Archive a card**

```json
{
  "name": "trello_archive_card",
  "arguments": {
    "id": "<cardId>"
  }
}
```

**Search for a card**

```json
{
  "name": "trello_search",
  "arguments": {
    "query": "login bug"
  }
}
```

---

## REST Fallback

Prefer MCP tool calls first. If MCP-over-HTTP is unavailable but the tunnel still responds, the REST API is available at:

```text
https://853a-1-46-159-93.ngrok-free.app/api
```
