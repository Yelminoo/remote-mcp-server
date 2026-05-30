import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../constants.js";
import { getCredentials } from "./credentials.js";
import { ApiError } from "../types.js";

// ─────────────────────────────────────────────
// AXIOS INSTANCE
// Auth (key + token) is NOT baked into defaults — injected per-request
// from the credentials service so GUI changes take effect immediately.
// ─────────────────────────────────────────────

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
    "Accept":        "application/json",
  },
});

// ─────────────────────────────────────────────
// PATH SANITIZATION
// ─────────────────────────────────────────────

export function sanitizePath(segment: string): string {
  return segment
    .replace(/\.\./g, "")
    .replace(/\//g, "")
    .replace(/\\/g, "")
    .replace(/\0/g, "")
    .trim();
}

// ─────────────────────────────────────────────
// GENERIC REQUEST HELPER
// ─────────────────────────────────────────────

export async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  params?: Record<string, unknown>,
  config?: AxiosRequestConfig,
): Promise<T> {
  const { apiKey, apiToken, source } = getCredentials();

  if (!apiKey || !apiToken) {
    throw {
      status:  401,
      message: source === "none"
        ? "Trello credentials not configured — open /dashboard to add them"
        : "Incomplete credentials — both API key and token are required",
    } as ApiError;
  }

  try {
    const response = await client.request<T>({
      method,
      url:    path,
      data:   body,
      // Trello auth: key + token as query params on every request
      params: { key: apiKey, token: apiToken, ...params },
      ...config,
    });
    return response.data;
  } catch (err: unknown) {
    throw parseError(err);
  }
}

// ─────────────────────────────────────────────
// SHORTHAND METHODS
// ─────────────────────────────────────────────

export const get   = <T>(path: string, params?: Record<string, unknown>) =>
  request<T>("GET", path, undefined, params);

export const post  = <T>(path: string, body?: unknown) =>
  request<T>("POST", path, body);

export const put   = <T>(path: string, body?: unknown) =>
  request<T>("PUT", path, body);

export const patch = <T>(path: string, body?: unknown) =>
  request<T>("PATCH", path, body);

export const del   = <T>(path: string) =>
  request<T>("DELETE", path);

// ─────────────────────────────────────────────
// ERROR PARSER
// ─────────────────────────────────────────────

const SAFE_HTTP_MESSAGES: Record<number, string> = {
  400: "Bad request — check your input parameters",
  401: "Authentication failed — check your TRELLO_API_KEY and TRELLO_TOKEN",
  403: "Permission denied — insufficient access to this Trello resource",
  404: "Resource not found",
  409: "Conflict — resource already exists or is in an invalid state",
  422: "Unprocessable input — Trello rejected the request body",
  429: "Rate limit exceeded — slow down requests or wait before retrying",
  500: "Trello server error — try again later",
  503: "Trello service unavailable — try again later",
};

function parseError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const status  = err.response?.status ?? 0;
    const message = SAFE_HTTP_MESSAGES[status] ?? `Request failed with status ${status}`;
    // Log server-side only — never include credentials in the log line
    console.error(`[api-client] ${err.config?.method?.toUpperCase()} ${err.config?.url} → ${status}`);
    return { status, message, code: err.code };
  }
  if (err instanceof Error) {
    console.error("[api-client] Unexpected error:", err.message);
    return { status: 0, message: "Unexpected error communicating with Trello" };
  }
  return { status: 0, message: "Unknown error" };
}
