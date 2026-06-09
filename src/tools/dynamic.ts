import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listTools } from "../services/tool-store.js";
import { ToolDef, ParamDef } from "../schemas/tool-definition.js";
import { textResponse, errorResponse } from "../services/formatter.js";

// Substitute ${ENV_VAR} references in header values
function resolveEnv(val: string): string {
  return val.replace(/\$\{([^}]+)\}/g, (_, k) => process.env[k] ?? "");
}

// Build a Zod shape Record from param definitions so MCP can generate the tool's input schema
function buildZodShape(params: ParamDef[]): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const p of params) {
    let base: z.ZodTypeAny;
    if (p.type === "number")       base = z.number().describe(p.description);
    else if (p.type === "boolean") base = z.boolean().describe(p.description);
    else                           base = z.string().describe(p.description);
    shape[p.name] = p.required ? base : base.optional();
  }
  return shape;
}

async function executeToolDef(
  def: ToolDef,
  args: Record<string, unknown>,
): Promise<string> {
  // 1. Substitute {param} placeholders in URL
  let url = def.url;
  for (const p of def.params.filter(p => p.in === "path")) {
    url = url.replace(`{${p.name}}`, encodeURIComponent(String(args[p.name] ?? "")));
  }

  // 2. Append query params
  const qp = def.params
    .filter(p => p.in === "query" && args[p.name] !== undefined)
    .map(p => `${encodeURIComponent(p.name)}=${encodeURIComponent(String(args[p.name]))}`);
  if (qp.length) url += (url.includes("?") ? "&" : "?") + qp.join("&");

  // 3. Build request headers (resolve ${ENV_VAR} in stored header values)
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(def.headers ?? {})) {
    headers[k] = resolveEnv(v);
  }
  for (const p of def.params.filter(p => p.in === "header")) {
    if (args[p.name] !== undefined) headers[p.name] = String(args[p.name]);
  }

  // 4. Build request body
  const body: Record<string, unknown> = {};
  for (const p of def.params.filter(p => p.in === "body")) {
    if (args[p.name] !== undefined) body[p.name] = args[p.name];
  }
  if (Object.keys(body).length) headers["Content-Type"] = "application/json";

  // 5. Execute HTTP call
  const res = await fetch(url, {
    method: def.method,
    headers,
    body: Object.keys(body).length ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);

  // Pretty-print JSON responses, pass raw text otherwise
  try { return JSON.stringify(JSON.parse(text), null, 2); }
  catch { return text; }
}

// Called inside createServer() — reads custom-tools.json and registers each enabled tool
export function registerDynamicTools(server: McpServer): number {
  const tools = listTools().filter(t => t.enabled);

  for (const def of tools) {
    const shape = buildZodShape(def.params);

    server.registerTool(def.name, {
      title: def.title,
      description: def.description,
      inputSchema: shape,
      annotations: {
        readOnlyHint:    def.readOnlyHint,
        destructiveHint: def.destructiveHint,
      },
    }, async (args) => {
      try {
        const result = await executeToolDef(def, args as Record<string, unknown>);
        return textResponse(result);
      } catch (err) {
        return errorResponse((err as Error).message);
      }
    });
  }

  return tools.length;
}
