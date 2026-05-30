export const SERVICE_NAME = "trello";
export const API_BASE_URL = process.env.API_BASE_URL ?? "https://api.trello.com/1";

// Credentials (API key + token) are managed by src/services/credentials.ts.
// They are loaded from env vars first, then from ~/.trello-mcp/credentials.json.
// Use the /dashboard GUI to set them without touching env vars.

export const CHARACTER_LIMIT    = 50_000;
export const DEFAULT_PAGE_SIZE  = 20;
export const MAX_PAGE_SIZE      = 100;
export const REQUEST_TIMEOUT_MS = 15_000;
export const BIND_HOST          = process.env.BIND_HOST ?? "127.0.0.1";
