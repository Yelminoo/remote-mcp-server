import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { get, sanitizePath } from "../services/api-client.js";
import { errorResponse, notFoundResponse } from "../services/formatter.js";
import { IdSchema } from "../schemas/common.js";

interface TrelloMember {
  id: string;
  username: string;
  fullName: string;
  url: string;
}

interface TrelloBoard {
  id: string;
  name: string;
  desc: string;
  closed: boolean;
  url: string;
  shortUrl: string;
}

interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  pos: number;
}

interface TrelloSearchResult {
  cards: Array<{ id: string; name: string; shortUrl: string; idList: string; idBoard: string; }>;
  boards: Array<{ id: string; name: string; shortUrl: string; }>;
}

const BOARD_FIELDS = "name,desc,closed,url,shortUrl";

export function registerBoardTools(server: McpServer): void {

  // ── WHO AM I ────────────────────────────────

  server.registerTool(
    "trello_get_me",
    {
      title: "Get My Profile",
      description: `Get the authenticated Trello member's profile and a list of all their boards.

Returns username, full name, and every open board with its ID.

Examples:
  - "Who am I on Trello?" → no params needed
  - "Show all my boards" → no params needed`,
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const [member, boards] = await Promise.all([
          get<TrelloMember>("/members/me", { fields: "username,fullName,url" }),
          get<TrelloBoard[]>("/members/me/boards", { fields: BOARD_FIELDS, filter: "open" }),
        ]);
        const lines = [
          `## ${member.fullName} (@${member.username})`,
          `${member.url}`,
          "",
          `### Boards (${boards.length})`,
          "",
          ...boards.map(b => `- **${b.name}** \`${b.id}\`${b.desc ? `\n  ${b.desc}` : ""}`),
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        return errorResponse((err as { message: string }).message);
      }
    },
  );

  // ── LIST BOARDS ─────────────────────────────

  server.registerTool(
    "trello_list_boards",
    {
      title: "List Boards",
      description: `List Trello boards for the authenticated member.

Args:
  - filter ('open'|'closed'|'all'): Which boards to return (default: 'open')

Returns board names, IDs, and short URLs.

Examples:
  - "Show all my boards" → no params
  - "List my archived boards" → filter: 'closed'`,
      inputSchema: {
        filter: z.enum(["open", "closed", "all"]).default("open").describe("Board state filter"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ filter }) => {
      try {
        const boards = await get<TrelloBoard[]>("/members/me/boards", { fields: BOARD_FIELDS, filter });
        const lines = [
          `## Boards (${boards.length})`,
          "",
          ...boards.map(b =>
            `- **${b.name}** \`${b.id}\`\n  ${b.shortUrl}${b.desc ? `\n  ${b.desc}` : ""}`
          ),
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        return errorResponse((err as { message: string }).message);
      }
    },
  );

  // ── GET BOARD ───────────────────────────────

  server.registerTool(
    "trello_get_board",
    {
      title: "Get Board",
      description: `Get a Trello board's details along with all its open lists (columns).

Args:
  - id (string): Board ID

Returns board name, description, URL, and every open list with its ID.

Examples:
  - "What lists are on board abc123?" → id: 'abc123'
  - "Show me the columns on my Dev board" → id: '<board-id>'`,
      inputSchema: { id: IdSchema },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      try {
        const boardId = sanitizePath(id);
        const [board, lists] = await Promise.all([
          get<TrelloBoard>(`/boards/${boardId}`, { fields: BOARD_FIELDS }),
          get<TrelloList[]>(`/boards/${boardId}/lists`, { filter: "open", fields: "name,pos" }),
        ]);
        const lines = [
          `## ${board.name}`,
          board.desc ? `\n${board.desc}\n` : "",
          `${board.shortUrl}`,
          "",
          `### Lists (${lists.length})`,
          "",
          ...lists.map(l => `- **${l.name}** \`${l.id}\``),
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        const e = err as { status?: number; message: string };
        if (e.status === 404) return notFoundResponse("Board", id);
        return errorResponse(e.message);
      }
    },
  );

  // ── SEARCH ──────────────────────────────────

  server.registerTool(
    "trello_search",
    {
      title: "Search Trello",
      description: `Search across all Trello boards, cards, and lists.

Args:
  - query (string): Search text
  - cards_limit (number): Max cards to return (default: 10, max: 50)
  - boards_limit (number): Max boards to return (default: 5, max: 10)

Returns matching cards and boards.

Examples:
  - "Find cards about login bug" → query: 'login bug'
  - "Search for the payments board" → query: 'payments'`,
      inputSchema: {
        query: z.string().min(1).max(200).describe("Search query"),
        cards_limit: z.number().int().min(1).max(50).default(10).describe("Max cards to return"),
        boards_limit: z.number().int().min(1).max(10).default(5).describe("Max boards to return"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ query, cards_limit, boards_limit }) => {
      try {
        const result = await get<TrelloSearchResult>("/search", {
          query,
          modelTypes: "cards,boards",
          card_fields: "name,shortUrl,idList,idBoard",
          board_fields: "name,shortUrl",
          cards_limit,
          boards_limit,
        });
        const lines: string[] = [];

        if (result.boards?.length) {
          lines.push(`### Boards (${result.boards.length})`, "");
          result.boards.forEach(b => lines.push(`- **${b.name}** \`${b.id}\`  ${b.shortUrl}`));
          lines.push("");
        }

        if (result.cards?.length) {
          lines.push(`### Cards (${result.cards.length})`, "");
          result.cards.forEach(c => lines.push(`- **${c.name}** \`${c.id}\`  ${c.shortUrl}`));
        }

        if (!lines.length) lines.push("No results found.");

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        return errorResponse((err as { message: string }).message);
      }
    },
  );
}
