import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { ToolDef, ToolDefSchema, CreateToolSchema } from "../schemas/tool-definition.js";

const STORE = join(process.cwd(), "custom-tools.json");

function read(): ToolDef[] {
  if (!existsSync(STORE)) return [];
  try {
    const raw = JSON.parse(readFileSync(STORE, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

function write(tools: ToolDef[]): void {
  writeFileSync(STORE, JSON.stringify(tools, null, 2), "utf8");
}

export function listTools(): ToolDef[] {
  return read();
}

export function createTool(data: unknown): ToolDef {
  const parsed = CreateToolSchema.parse(data);
  const tools = read();
  if (tools.some(t => t.name === parsed.name)) {
    throw new Error(`Tool name "${parsed.name}" is already in use`);
  }
  const tool: ToolDef = { ...parsed, id: randomUUID(), createdAt: Date.now() };
  tools.push(tool);
  write(tools);
  return tool;
}

export function updateTool(id: string, data: unknown): ToolDef {
  const tools = read();
  const idx = tools.findIndex(t => t.id === id);
  if (idx === -1) throw new Error("Tool not found");
  const existing = tools[idx];
  const patch = CreateToolSchema.partial().parse(data);
  const updated = ToolDefSchema.parse({ ...existing, ...patch, id, createdAt: existing.createdAt });
  if (tools.some(t => t.id !== id && t.name === updated.name)) {
    throw new Error(`Tool name "${updated.name}" is already in use`);
  }
  tools[idx] = updated;
  write(tools);
  return updated;
}

export function deleteTool(id: string): boolean {
  const tools = read();
  const idx = tools.findIndex(t => t.id === id);
  if (idx === -1) return false;
  tools.splice(idx, 1);
  write(tools);
  return true;
}
