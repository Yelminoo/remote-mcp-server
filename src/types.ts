// ─────────────────────────────────────────────
// RESPONSE FORMATS
// ─────────────────────────────────────────────

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

// ─────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  count: number;
  offset: number;
  has_more: boolean;
  next_offset?: number;
}

// ─────────────────────────────────────────────
// API ERROR
// ─────────────────────────────────────────────

export interface ApiError {
  status: number;
  message: string;
  code?: string;
}

// ─────────────────────────────────────────────
// MCP TOOL RESPONSE
// Use the SDK's CallToolResult type directly in handlers.
// This alias is kept for reference only.
// ─────────────────────────────────────────────

export interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  [key: string]: unknown; // required for SDK index signature compatibility
}

// ─────────────────────────────────────────────
// ADD YOUR SERVICE-SPECIFIC TYPES BELOW
// Example:
//
// export interface Project {
//   id: string;
//   name: string;
//   status: "active" | "archived";
//   created_at: string;
// }
// ─────────────────────────────────────────────
