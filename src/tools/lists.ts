import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { get, post, put, sanitizePath } from "../services/api-client.js";
import { jsonResponse, errorResponse, notFoundResponse } from "../services/formatter.js";
import { IdSchema } from "../schemas/common.js";

interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  idBoard: string;
  pos: number;
}

interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  dueComplete: boolean;
  closed: boolean;
  shortUrl: string;
  labels: Array<{ id: string; name: string; color: string }>;
}

const CARD_FIELDS = "name,desc,due,dueComplete,closed,shortUrl,labels";

export function registerListTools(server: McpServer): void {

  // ── GET LIST CARDS ───────────────────────────

  server.registerTool(
    "trello_get_list_cards",
    {
      title: "Get List Cards",
      description: `Get all cards in a Trello list (column).

Args:
  - id (string): List ID
  - filter ('open'|'closed'|'all'): Card state (default: 'open')

Returns each card's name, ID, description, due date, and labels.

Examples:
  - "Show cards in list abc123" → id: 'abc123'
  - "Show archived cards in list abc123" → id: 'abc123', filter: 'closed'`,
      inputSchema: {
        id: IdSchema,
        filter: z.enum(["open", "closed", "all"]).default("open").describe("Card state filter"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id, filter }) => {
      try {
        const listId = sanitizePath(id);
        const [list, cards] = await Promise.all([
          get<TrelloList>(`/lists/${listId}`, { fields: "name,idBoard" }),
          get<TrelloCard[]>(`/lists/${listId}/cards`, { filter, fields: CARD_FIELDS }),
        ]);
        const lines = [
          `## ${list.name} — ${cards.length} card${cards.length !== 1 ? "s" : ""}`,
          "",
        ];
        for (const c of cards) {
          lines.push(`### ${c.name} \`${c.id}\``);
          if (c.due) {
            const d = new Date(c.due).toLocaleDateString();
            lines.push(`📅 Due: ${d}${c.dueComplete ? " ✅" : ""}`);
          }
          if (c.labels.length) {
            lines.push(`🏷 ${c.labels.map(l => l.name || l.color).join(", ")}`);
          }
          if (c.desc) {
            lines.push(c.desc.slice(0, 120) + (c.desc.length > 120 ? "…" : ""));
          }
          lines.push(`${c.shortUrl}`, "");
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        const e = err as { status?: number; message: string };
        if (e.status === 404) return notFoundResponse("List", id);
        return errorResponse(e.message);
      }
    },
  );

  // ── CREATE LIST ──────────────────────────────

  server.registerTool(
    "trello_create_list",
    {
      title: "Create List",
      description: `Create a new list (column) on a Trello board.

Args:
  - idBoard (string): Board ID
  - name (string): List name
  - pos ('top'|'bottom'): Position on the board (default: 'bottom')

Returns the created list with its assigned ID.

Examples:
  - "Add a 'Review' column to board abc123" → idBoard: 'abc123', name: 'Review'`,
      inputSchema: {
        idBoard: IdSchema.describe("Board ID"),
        name: z.string().min(1).max(200).describe("List name"),
        pos: z.enum(["top", "bottom"]).default("bottom").describe("Position on the board"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ idBoard, name, pos }) => {
      try {
        const list = await post<TrelloList>("/lists", {
          idBoard: sanitizePath(idBoard),
          name,
          pos,
        });
        return jsonResponse(list as unknown as Record<string, unknown>);
      } catch (err) {
        const e = err as { status?: number; message: string };
        if (e.status === 404) return notFoundResponse("Board", idBoard);
        return errorResponse(e.message);
      }
    },
  );

  // ── ARCHIVE LIST ─────────────────────────────

  server.registerTool(
    "trello_archive_list",
    {
      title: "Archive List",
      description: `Archive a Trello list. Hides it from the board without deleting cards.

⚠️ Cards in the list are also hidden. Use trello_update_card to move important cards first.

Args:
  - id (string): List ID

Returns confirmation with the list name.

Examples:
  - "Archive the Done list abc123" → id: 'abc123'`,
      inputSchema: { id: IdSchema },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ id }) => {
      try {
        const listId = sanitizePath(id);
        const list = await put<TrelloList>(`/lists/${listId}`, { closed: true });
        return { content: [{ type: "text", text: `List '${list.name}' archived successfully. ID: ${list.id}` }] };
      } catch (err) {
        const e = err as { status?: number; message: string };
        if (e.status === 404) return notFoundResponse("List", id);
        return errorResponse(e.message);
      }
    },
  );
}
