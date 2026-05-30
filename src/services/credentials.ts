import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// Stored in the user's home directory — never inside the git repo
const CONFIG_DIR  = join(homedir(), ".trello-mcp");
const CREDS_FILE  = join(CONFIG_DIR, "credentials.json");

export type CredentialSource = "env" | "file" | "none";

interface CredentialState {
  apiKey:   string;
  apiToken: string;
  source:   CredentialSource;
}

export interface CredentialStatus {
  configured:     boolean;
  source:         CredentialSource;
  apiKeyMasked:   string;
  apiTokenMasked: string;
}

// ── In-memory cache ──────────────────────────
// Populated lazily, cleared on saveCredentials()
let cache: CredentialState | null = null;

// ── Helpers ──────────────────────────────────

function readFile(): { apiKey: string; apiToken: string } | null {
  if (!existsSync(CREDS_FILE)) return null;
  try {
    const raw      = JSON.parse(readFileSync(CREDS_FILE, "utf8"));
    const apiKey   = String(raw.TRELLO_API_KEY   ?? "").trim();
    const apiToken = String(raw.TRELLO_TOKEN      ?? "").trim();
    if (apiKey && apiToken) return { apiKey, apiToken };
  } catch { /* corrupt file — ignore */ }
  return null;
}

function load(): CredentialState {
  // 1. Environment variables take precedence and are never overridden by the GUI
  const envKey   = (process.env.TRELLO_API_KEY ?? process.env.API_KEY   ?? "").trim();
  const envToken = (process.env.TRELLO_TOKEN   ?? process.env.API_TOKEN ?? "").trim();
  if (envKey && envToken) return { apiKey: envKey, apiToken: envToken, source: "env" };

  // 2. Credentials file (written by the GUI)
  const file = readFile();
  if (file) return { ...file, source: "file" };

  return { apiKey: "", apiToken: "", source: "none" };
}

// ── Public API ───────────────────────────────

export function getCredentials(): CredentialState {
  return cache ?? (cache = load());
}

export function saveCredentials(apiKey: string, apiToken: string): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(
    CREDS_FILE,
    JSON.stringify({ TRELLO_API_KEY: apiKey, TRELLO_TOKEN: apiToken }, null, 2),
    { encoding: "utf8", mode: 0o600 },  // owner read/write only
  );
  cache = null; // next getCredentials() will re-read the file
}

/** Returns only masked values — never the real credentials. Safe to send over the API. */
export function getStatus(): CredentialStatus {
  const { apiKey, apiToken, source } = getCredentials();
  return {
    configured:     !!(apiKey && apiToken),
    source,
    apiKeyMasked:   mask(apiKey),
    apiTokenMasked: mask(apiToken),
  };
}

function mask(s: string): string {
  if (!s) return "";
  if (s.length <= 8) return "••••••••";
  return s.slice(0, 4) + "•".repeat(Math.min(s.length - 8, 16)) + s.slice(-4);
}
