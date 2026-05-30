import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../constants.js";
import { ResponseFormat } from "../types.js";

// ─────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────

export const PaginationSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .describe(`Max results to return (1–${MAX_PAGE_SIZE}, default ${DEFAULT_PAGE_SIZE})`),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Number of results to skip for pagination"),
});

// ─────────────────────────────────────────────
// RESPONSE FORMAT
// ─────────────────────────────────────────────

export const ResponseFormatSchema = z.object({
  response_format: z
    .nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for readable text or 'json' for structured data"),
});

// ─────────────────────────────────────────────
// COMMON FIELDS
// ─────────────────────────────────────────────

// Safe ID: alphanumeric + hyphens/underscores only
// Blocks path traversal attempts like "../admin" or "/etc/passwd"
export const IdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9_\-]+$/, "ID must contain only alphanumeric characters, hyphens, or underscores")
  .describe("Unique identifier");

// Search query: trimmed, no null bytes
export const SearchQuerySchema = z
  .string()
  .min(1)
  .max(200)
  .transform((s) => s.trim())
  .refine((s) => !s.includes("\0"), "Query must not contain null bytes")
  .describe("Search query string");
