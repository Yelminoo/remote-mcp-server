import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { get, post, put, del, sanitizePath } from "../services/api-client.js";
import { jsonResponse, errorResponse, notFoundResponse } from "../services/formatter.js";
import { IdSchema } from "../schemas/common.js";

interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  dueComplete: boolean;
  closed: boolean;
  idList: string;
  idBoard: string;
  url: string;
  shortUrl: string;
  labels: Array<{ id: string; name: string; color: string }>;
  pos: number;
}

interface TrelloAction {
  id: string;
  type: string;
  date: string;
  memberCreator: { username: string; fullName: string };
  data: { text?: string };
}

const CARD_FIELDS = "name,desc,due,dueComplete,closed,idList,idBoard,url,shortUrl,labels,pos";

export function registerCardTools(server: McpServer): void {

  // ── GET CARD ─────────────────────────────────

  server.registerTool(
    "trello_get_card",
    {
      title: "Get Card",
      description: `Get full details of a Trello card by ID.

Args:
  - id (string): Card ID

Returns name, description, due date, labels, list, board, and URL.

Examples:
  - "Show me card abc123" → id: 'abc123'`,
      inputSchema: { id: IdSchema },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      try {
        const card = await get<TrelloCard>(`/cards/${sanitizePath(id)}`, { fields: CARD_FIELDS });
        const lines = [
          `## ${card.name}`,
          `**ID:** \`${card.id}\``,
          `**List:** \`${card.idList}\` | **Board:** \`${card.idBoard}\``,
        ];
        if (card.due) lines.push(`**Due:** ${new Date(card.due).toLocaleString()}${card.dueComplete ? " ✅" : ""}`);
        if (card.labels.length) lines.push(`**Labels:** ${card.labels.map(l => l.name || l.color).join(", ")}`);
        if (card.desc) lines.push("", card.desc);
        lines.push("", card.shortUrl);
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        const e = err as { status?: number; message: string };
        if (e.status === 404) return notFoundResponse("Card", id);
        return errorResponse(e.message);
      }
    },
  );

  // ── CREATE CARD ──────────────────────────────

  server.registerTool(
    "trello_create_card",
    {
      title: "Create Card",
      description: `Create a new card in a Trello list.

Args:
  - idList (string): List ID to add the card to (required)
  - name (string): Card title (required)
  - desc (string): Card description in Markdown (optional)
  - due (string): Due date as ISO 8601 string e.g. '2025-06-30T09:00:00Z' (optional)
  - pos ('top'|'bottom'): Position in the list (default: 'bottom')

Returns the created card with its ID and URL.

Examples:
  - "Add card 'Fix login bug' to list abc123" → idList: 'abc123', name: 'Fix login bug'
  - "Create a card due Friday" → idList: '...', name: '...', due: '2025-05-30T17:00:00Z'`,
      inputSchema: {
        idList: IdSchema.describe("List ID"),
        name: z.string().min(1).max(16384).describe("Card title"),
        desc: z.string().max(16384).optional().describe("Card description (Markdown)"),
        due: z.string().optional().describe("Due date (ISO 8601)"),
        pos: z.enum(["top", "bottom"]).default("bottom").describe("Position in the list"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ idList, name, desc, due, pos }) => {
      try {
        const card = await post<TrelloCard>("/cards", {
          idList: sanitizePath(idList),
          name,
          ...(desc !== undefined && { desc }),
          ...(due !== undefined && { due }),
          pos,
        });
        return jsonResponse(card as unknown as Record<string, unknown>);
      } catch (err) {
        const e = err as { status?: number; message: string };
        if (e.status === 404) return notFoundResponse("List", idList);
        return errorResponse(e.message, "Check that the list ID is valid.");
      }
    },
  );

  // ── UPDATE CARD ──────────────────────────────

  server.registerTool(
    "trello_update_card",
    {
      title: "Update Card",
      description: `Update fields on an existing Trello card.

Args:
  - id (string): Card ID
  - name (string): New title (optional)
  - desc (string): New description (optional)
  - due (string|null): New due date ISO 8601, or null to remove (optional)
  - dueComplete (boolean): Mark due date complete/incomplete (optional)
  - pos ('top'|'bottom'): New position in current list (optional)

Returns the updated card.

Examples:
  - "Rename card abc123 to 'New title'" → id: 'abc123', name: 'New title'
  - "Mark card abc123 due date as done" → id: 'abc123', dueComplete: true
  - "Remove due date from card abc123" → id: 'abc123', due: null`,
      inputSchema: {
        id: IdSchema,
        name: z.string().min(1).max(16384).optional().describe("New card title"),
        desc: z.string().max(16384).optional().describe("New description"),
        due: z.string().nullable().optional().describe("Due date (ISO 8601) or null to remove"),
        dueComplete: z.boolean().optional().describe("Mark due date complete"),
        pos: z.union([z.enum(["top", "bottom"]), z.number().positive()])
          .optional()
          .describe("Position: 'top', 'bottom', or a number"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id, ...updates }) => {
      try {
        const card = await put<TrelloCard>(`/cards/${sanitizePath(id)}`, updates);
        return jsonResponse(card as unknown as Record<string, unknown>);
      } catch (err) {
        const e = err as { status?: number; message: string };
        if (e.status === 404) return notFoundResponse("Card", id);
        return errorResponse(e.message);
      }
    },
  );

  // ── MOVE CARD ────────────────────────────────

  server.registerTool(
    "trello_move_card",
    {
      title: "Move Card",
      description: `Move a Trello card to a different list (column), optionally on a different board.

Args:
  - id (string): Card ID
  - idList (string): Destination list ID
  - idBoard (string): Destination board ID — required when moving to a different board (optional)
  - pos ('top'|'bottom'): Position in the destination list (default: 'bottom')

Returns the updated card.

Examples:
  - "Move card abc123 to list xyz789" → id: 'abc123', idList: 'xyz789'
  - "Move card to top of Done list" → id: '...', idList: '...', pos: 'top'`,
      inputSchema: {
        id: IdSchema,
        idList: IdSchema.describe("Destination list ID"),
        idBoard: IdSchema.optional().describe("Destination board ID (required when moving boards)"),
        pos: z.enum(["top", "bottom"]).default("bottom").describe("Position in destination list"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id, idList, idBoard, pos }) => {
      try {
        const body: Record<string, unknown> = { idList: sanitizePath(idList), pos };
        if (idBoard) body.idBoard = sanitizePath(idBoard);
        const card = await put<TrelloCard>(`/cards/${sanitizePath(id)}`, body);
        return { content: [{ type: "text", text: `Card '${card.name}' moved to list \`${card.idList}\` (pos: ${pos}).` }] };
      } catch (err) {
        const e = err as { status?: number; message: string };
        if (e.status === 404) return notFoundResponse("Card or List", id);
        return errorResponse(e.message);
      }
    },
  );

  // ── ARCHIVE CARD ─────────────────────────────

  server.registerTool(
    "trello_archive_card",
    {
      title: "Archive Card",
      description: `Archive (close) a Trello card. It's hidden from the board but not permanently deleted.

⚠️ Use trello_update_card with closed: false to restore it.

Args:
  - id (string): Card ID

Returns confirmation.

Examples:
  - "Archive card abc123" → id: 'abc123'`,
      inputSchema: { id: IdSchema },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ id }) => {
      try {
        const card = await put<TrelloCard>(`/cards/${sanitizePath(id)}`, { closed: true });
        return { content: [{ type: "text", text: `Card '${card.name}' archived. \`${card.id}\`` }] };
      } catch (err) {
        const e = err as { status?: number; message: string };
        if (e.status === 404) return notFoundResponse("Card", id);
        return errorResponse(e.message);
      }
    },
  );

  // ── DELETE CARD ──────────────────────────────

  server.registerTool(
    "trello_delete_card",
    {
      title: "Delete Card",
      description: `Permanently delete a Trello card. This cannot be undone.

⚠️ Consider using trello_archive_card instead — it hides the card but preserves it.

Args:
  - id (string): Card ID

Returns confirmation.`,
      inputSchema: { id: IdSchema },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ id }) => {
      try {
        await del(`/cards/${sanitizePath(id)}`);
        return { content: [{ type: "text", text: `Card \`${id}\` permanently deleted.` }] };
      } catch (err) {
        const e = err as { status?: number; message: string };
        if (e.status === 404) return notFoundResponse("Card", id);
        return errorResponse(e.message);
      }
    },
  );

  // ── ADD COMMENT ──────────────────────────────

  server.registerTool(
    "trello_add_comment",
    {
      title: "Add Comment",
      description: `Add a comment to a Trello card.

Args:
  - id (string): Card ID
  - text (string): Comment text (Markdown supported)

Returns the created comment action.

Examples:
  - "Comment 'Fixed in PR #42' on card abc123" → id: 'abc123', text: 'Fixed in PR #42'`,
      inputSchema: {
        id: IdSchema,
        text: z.string().min(1).max(16384).describe("Comment text (Markdown supported)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ id, text }) => {
      try {
        const action = await post<TrelloAction>(`/cards/${sanitizePath(id)}/actions/comments`, { text });
        return {
          content: [{
            type: "text",
            text: `Comment added by @${action.memberCreator.username} on ${new Date(action.date).toLocaleString()}.`,
          }],
        };
      } catch (err) {
        const e = err as { status?: number; message: string };
        if (e.status === 404) return notFoundResponse("Card", id);
        return errorResponse(e.message);
      }
    },
  );

  // ── GET COMMENTS ─────────────────────────────

  server.registerTool(
    "trello_get_card_comments",
    {
      title: "Get Card Comments",
      description: `Get comments on a Trello card, newest first.

Args:
  - id (string): Card ID
  - limit (number): Max comments to return (default: 20, max: 50)

Returns each comment's author, date, and text.

Examples:
  - "Show comments on card abc123" → id: 'abc123'`,
      inputSchema: {
        id: IdSchema,
        limit: z.number().int().min(1).max(50).default(20).describe("Max comments to return"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id, limit }) => {
      try {
        const actions = await get<TrelloAction[]>(`/cards/${sanitizePath(id)}/actions`, {
          filter: "commentCard",
          limit,
        });
        if (!actions.length) {
          return { content: [{ type: "text", text: "No comments on this card." }] };
        }
        const lines = [`## Comments (${actions.length})`, ""];
        for (const a of actions) {
          lines.push(
            `**@${a.memberCreator.username}** — ${new Date(a.date).toLocaleString()}`,
            a.data.text ?? "",
            "",
          );
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        const e = err as { status?: number; message: string };
        if (e.status === 404) return notFoundResponse("Card", id);
        return errorResponse(e.message);
      }
    },
  );
}
