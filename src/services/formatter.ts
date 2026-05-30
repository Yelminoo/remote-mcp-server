import { CHARACTER_LIMIT } from "../constants.js";
import { PaginatedResponse, ToolResponse } from "../types.js";

// ─────────────────────────────────────────────
// SUCCESS RESPONSES
// ─────────────────────────────────────────────

export function textResponse(text: string): ToolResponse {
  return {
    content: [{ type: "text", text: truncate(text) }],
  };
}

export function jsonResponse<T extends Record<string, unknown>>(data: T): ToolResponse {
  const text = JSON.stringify(data, null, 2);
  return {
    content: [{ type: "text", text: truncate(text) }],
    structuredContent: data,
  };
}

export function paginatedResponse<T>(
  label: string,
  result: PaginatedResponse<T>,
  renderItem: (item: T, index: number) => string,
): ToolResponse {
  const lines: string[] = [
    `## ${label}`,
    `Showing ${result.count} of ${result.total} results (offset: ${result.offset})`,
    "",
  ];

  result.items.forEach((item, i) => {
    lines.push(renderItem(item, i));
  });

  if (result.has_more) {
    lines.push(`\n_More results available — use offset: ${result.next_offset}_`);
  }

  return textResponse(lines.join("\n"));
}

// ─────────────────────────────────────────────
// ERROR RESPONSES
// ─────────────────────────────────────────────

export function errorResponse(message: string, hint?: string): ToolResponse {
  const text = hint ? `Error: ${message}\n\nHint: ${hint}` : `Error: ${message}`;
  return {
    content: [{ type: "text", text }],
    isError: true,
  };
}

export function notFoundResponse(resource: string, id: string): ToolResponse {
  return errorResponse(
    `${resource} '${id}' not found`,
    `Check the ID is correct and that you have access to this ${resource.toLowerCase()}.`,
  );
}

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  const notice = `\n\n[Response truncated at ${CHARACTER_LIMIT} characters. Use pagination or filters to narrow results.]`;
  return text.slice(0, CHARACTER_LIMIT - notice.length) + notice;
}
