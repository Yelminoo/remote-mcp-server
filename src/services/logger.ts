import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { SERVICE_NAME } from "../constants.js";

// Resolve log path relative to the package root (works from dist/services/)
const PKG_ROOT  = join(dirname(fileURLToPath(import.meta.url)), "../../");
const LOGS_DIR  = join(PKG_ROOT, "logs");
const LOG_FILE  = join(LOGS_DIR, "server.log");
const MAX_BYTES = 10 * 1024 * 1024; // rotate at 10 MB

// ── Init: create dir, rotate if too large ────
mkdirSync(LOGS_DIR, { recursive: true });
if (existsSync(LOG_FILE) && statSync(LOG_FILE).size > MAX_BYTES) {
  renameSync(LOG_FILE, LOG_FILE + ".1");
}

// ── Types ────────────────────────────────────
type Level = "info" | "warn" | "error" | "debug";
type Fields = Record<string, unknown>;

// ── Core write ───────────────────────────────
function write(level: Level, msg: string, fields: Fields = {}): void {
  const entry = {
    ts:      new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    msg,
    ...fields,
  };
  try {
    appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n", "utf8");
  } catch {
    // Never crash the server because logging failed
  }
}

// ── Public API ───────────────────────────────
export const logger = {
  info:  (msg: string, fields?: Fields) => write("info",  msg, fields),
  warn:  (msg: string, fields?: Fields) => write("warn",  msg, fields),
  error: (msg: string, fields?: Fields) => write("error", msg, fields),
  debug: (msg: string, fields?: Fields) => write("debug", msg, fields),
  /** Convenience: pick level from HTTP status code */
  request: (method: string, path: string, status: number, durationMs: number) => {
    const level: Level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    write(level, "request", { method, path, status, durationMs });
  },
};
