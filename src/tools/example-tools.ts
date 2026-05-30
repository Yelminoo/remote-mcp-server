/**
 * EXAMPLE TOOLS FILE
 * ──────────────────
 * Clone this file for each domain of your service.
 * e.g. tools/boards.ts, tools/cards.ts, tools/users.ts
 *
 * Each file exports a registerXxxTools(server) function
 * called once from index.ts.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { get, post, patch, del, sanitizePath } from "../services/api-client.js";
import { jsonResponse, errorResponse, notFoundResponse } from "../services/formatter.js";
import { PaginationSchema, ResponseFormatSchema, IdSchema } from "../schemas/common.js";

// ─────────────────────────────────────────────
// TYPES  (move to types.ts when growing)
// ─────────────────────────────────────────────

interface ExampleItem {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

// ─────────────────────────────────────────────
// TOOL REGISTRATION
// ─────────────────────────────────────────────

export function registerExampleTools(server: McpServer): void {

  // ── LIST ────────────────────────────────────

  server.registerTool(
    "{{service}}_list_items",
    {
      title: "List Items",
      description: `List all items from {{service}} with optional pagination.

Returns a paginated list of items. Use limit/offset for pagination.

Args:
  - limit (number): Max results (default: 20, max: 100)
  - offset (number): Skip N results for pagination (default: 0)
  - response_format ('markdown'|'json'): Output format (default: 'markdown')

Returns:
  List of items with id, name, status, created_at.

Examples:
  - "Show me all items" → no params needed
  - "Show next page"   → offset: 20`,
      inputSchema: {
        ...PaginationSchema.shape,
        ...ResponseFormatSchema.shape,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ limit, offset, response_format }) => {
      try {
        const data = await get<{ items: ExampleItem[]; total: number }>(
          "/items",
          { limit, offset },
        );

        if (response_format === "json") {
          return jsonResponse({
            total: data.total,
            count: data.items.length,
            offset,
            items: data.items,
            has_more: data.total > offset + data.items.length,
          });
        }

        const lines = [
          `## Items (${data.items.length} of ${data.total})`,
          "",
          ...data.items.map(
            (item) => `- **${item.name}** \`${item.id}\` — ${item.status}`,
          ),
        ];

        if (data.total > offset + data.items.length) {
          lines.push(`\n_More results — use offset: ${offset + limit}_`);
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        const e = err as { message: string };
        return errorResponse(e.message, "Check your API credentials and network connection.");
      }
    },
  );

  // ── GET ─────────────────────────────────────

  server.registerTool(
    "{{service}}_get_item",
    {
      title: "Get Item",
      description: `Get a single item by ID from {{service}}.

Args:
  - id (string): The item ID

Returns:
  Full item details including id, name, status, created_at.

Error handling:
  - Returns not-found error if the ID doesn't exist`,
      inputSchema: {
        id: IdSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const item = await get<ExampleItem>(`/items/${sanitizePath(id)}`);
        return jsonResponse(item as unknown as Record<string, unknown>);
      } catch (err) {
        const e = err as { status?: number; message: string };
        if (e.status === 404) return notFoundResponse("Item", id);
        return errorResponse(e.message);
      }
    },
  );

  // ── CREATE ──────────────────────────────────

  server.registerTool(
    "{{service}}_create_item",
    {
      title: "Create Item",
      description: `Create a new item in {{service}}.

Args:
  - name (string): Display name for the item (required)
  - status (string): Initial status — 'active' or 'draft' (default: 'draft')

Returns:
  The newly created item with its assigned ID.`,
      inputSchema: {
        name: z.string().min(1).max(200).describe("Display name for the item"),
        status: z
          .enum(["active", "draft"])
          .default("draft")
          .describe("Initial status"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ name, status }) => {
      try {
        const item = await post<ExampleItem>("/items", { name, status });
        return jsonResponse(item as unknown as Record<string, unknown>);
      } catch (err) {
        const e = err as { message: string };
        return errorResponse(e.message, "Ensure all required fields are provided.");
      }
    },
  );

  // ── UPDATE ──────────────────────────────────

  server.registerTool(
    "{{service}}_update_item",
    {
      title: "Update Item",
      description: `Update an existing item in {{service}}.

Args:
  - id (string): The item ID to update
  - name (string): New display name (optional)
  - status (string): New status — 'active' or 'draft' (optional)

Returns:
  The updated item.`,
      inputSchema: {
        id: IdSchema,
        name: z.string().min(1).max(200).optional().describe("New display name"),
        status: z.enum(["active", "draft"]).optional().describe("New status"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id, ...updates }) => {
      try {
        const item = await patch<ExampleItem>(`/items/${sanitizePath(id)}`, updates);
        return jsonResponse(item as unknown as Record<string, unknown>);
      } catch (err) {
        const e = err as { status?: number; message: string };
        if (e.status === 404) return notFoundResponse("Item", id);
        return errorResponse(e.message);
      }
    },
  );

  // ── DELETE ──────────────────────────────────

  server.registerTool(
    "{{service}}_delete_item",
    {
      title: "Delete Item",
      description: `Delete an item from {{service}} permanently.

⚠️ This action is irreversible.

Args:
  - id (string): The item ID to delete

Returns:
  Confirmation message on success.`,
      inputSchema: {
        id: IdSchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,   // ← mark destructive ops
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        await del(`/items/${sanitizePath(id)}`);
        return { content: [{ type: "text", text: `Item '${id}' deleted successfully.` }] };
      } catch (err) {
        const e = err as { status?: number; message: string };
        if (e.status === 404) return notFoundResponse("Item", id);
        return errorResponse(e.message);
      }
    },
  );
}
