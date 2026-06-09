import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Request, Response, NextFunction } from "express";
import { SERVICE_NAME } from "./constants.js";
import { getStatus } from "./services/credentials.js";
import { logger } from "./services/logger.js";

import { registerBoardTools }   from "./tools/boards.js";
import { registerListTools }    from "./tools/lists.js";
import { registerCardTools }    from "./tools/cards.js";
import { registerDynamicTools } from "./tools/dynamic.js";
import { analyticsMiddleware }  from "./middleware/analytics.js";
import { createRestRouter }     from "./routes/rest.js";
import { createDashboardRouter } from "./routes/dashboard.js";

// Credentials check — warn but don't exit; GUI allows setting them without restart
const { configured, source } = getStatus();
if (!configured) {
  const port = process.env.PORT ?? "3000";
  const msg = `No credentials — open http://127.0.0.1:${port}/dashboard to configure.`;
  console.warn(`[${SERVICE_NAME}-mcp] ${msg}`);
  logger.warn("startup_no_credentials");
} else {
  logger.info("credentials_loaded", { source });
}

function createServer(): McpServer {
  const server = new McpServer({
    name: `${SERVICE_NAME}-mcp-server`,
    version: "1.0.0",
  });
  registerBoardTools(server);
  registerListTools(server);
  registerCardTools(server);
  registerDynamicTools(server);
  return server;
}

async function runStdio(): Promise<void> {
  logger.info("server_start", { transport: "stdio" });
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVICE_NAME}-mcp] Running on stdio`);
}

async function runHTTP(): Promise<void> {
  const app  = express();
  const port = parseInt(process.env.PORT ?? "3000");

  app.use(express.json({ limit: "1mb" }));
  app.use(analyticsMiddleware);

  // DNS rebinding protection
  const ALLOWED_ORIGINS = new Set([
    "http://localhost",
    "http://127.0.0.1",
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    `https://claude.ai`,
  ]);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin) { next(); return; }
    if (!ALLOWED_ORIGINS.has(origin)) {
      logger.warn("blocked_origin", { origin });
      res.status(403).json({ error: "Forbidden: untrusted Origin" });
      return;
    }
    next();
  });

  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api",       createRestRouter());
  app.use("/dashboard", createDashboardRouter());

  app.post("/mcp", async (req, res) => {
    const server    = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const bindHost = process.env.BIND_HOST ?? "127.0.0.1";
  app.listen(port, bindHost, () => {
    const msg = `HTTP server on http://${bindHost}:${port}/mcp`;
    console.error(`[${SERVICE_NAME}-mcp] ${msg}`);
    logger.info("server_start", { transport: "http", host: bindHost, port });
  });
}

async function runRemote(): Promise<void> {
  const app      = express();
  const port     = parseInt(process.env.PORT ?? "3001");
  const bindHost = process.env.BIND_HOST ?? "0.0.0.0";
  const authToken = process.env.MCP_AUTH_TOKEN?.trim();

  if (!authToken) {
    console.warn(`[${SERVICE_NAME}-mcp] WARNING: MCP_AUTH_TOKEN not set — remote server is unprotected`);
    logger.warn("remote_no_auth_token");
  }

  app.use(express.json({ limit: "1mb" }));
  app.use(analyticsMiddleware);

  // CORS — allow configurable origins (defaults to all in remote mode)
  const corsOrigins = process.env.CORS_ORIGINS
    ? new Set(process.env.CORS_ORIGINS.split(",").map(s => s.trim()))
    : null; // null = allow all origins

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (corsOrigins === null) {
      res.setHeader("Access-Control-Allow-Origin", origin ?? "*");
    } else if (origin && corsOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") { res.sendStatus(204); return; }
    next();
  });

  // Bearer token auth — skipped when MCP_AUTH_TOKEN is unset
  function requireAuth(req: Request, res: Response, next: NextFunction): void {
    if (!authToken) { next(); return; }
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: Bearer token required" });
      return;
    }
    if (header.slice(7) !== authToken) {
      logger.warn("remote_auth_failed", { ip: req.ip });
      res.status(401).json({ error: "Unauthorized: invalid token" });
      return;
    }
    next();
  }

  // Public: health check
  app.get("/health", (_req, res) => res.json({ status: "ok", transport: "remote" }));

  // Protected: REST API and dashboard
  app.use("/api",       requireAuth, createRestRouter());
  app.use("/dashboard", requireAuth, createDashboardRouter());

  // ── SSE Transport (MCP 2024-11-05 spec) ──────────────────────────────────
  // Compatible with: Claude Desktop remote MCP, Cursor, older clients
  const sseSessions = new Map<string, SSEServerTransport>();

  app.get("/sse", requireAuth, async (req: Request, res: Response) => {
    const transport = new SSEServerTransport("/messages", res);
    const mcpServer = createServer();
    sseSessions.set(transport.sessionId, transport);

    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      sseSessions.delete(transport.sessionId);
      logger.info("sse_session_closed", { sessionId: transport.sessionId });
    };
    transport.onclose = cleanup;
    res.on("close", cleanup);

    logger.info("sse_session_opened", { sessionId: transport.sessionId, ip: req.ip });
    await mcpServer.connect(transport);
  });

  app.post("/messages", requireAuth, async (req: Request, res: Response) => {
    const sessionId = String(req.query.sessionId ?? "");
    const transport = sseSessions.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  // ── Streamable HTTP Transport (MCP 2025-03-26 spec) ──────────────────────
  // Compatible with: Claude.ai, MCP Inspector, newer clients
  app.post("/mcp", requireAuth, async (req: Request, res: Response) => {
    const mcpServer = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.listen(port, bindHost, () => {
    const base = `http://${bindHost}:${port}`;
    console.error(`[${SERVICE_NAME}-mcp] Remote MCP server on ${base}`);
    console.error(`[${SERVICE_NAME}-mcp]   SSE  (2024 spec): ${base}/sse`);
    console.error(`[${SERVICE_NAME}-mcp]   HTTP (2025 spec): ${base}/mcp`);
    console.error(`[${SERVICE_NAME}-mcp]   Auth: ${authToken ? "Bearer token enabled" : "UNPROTECTED (set MCP_AUTH_TOKEN)"}`);
    logger.info("server_start", { transport: "remote", host: bindHost, port });
  });
}

const transport = process.env.TRANSPORT ?? "stdio";

if (transport === "http") {
  runHTTP().catch((err) => {
    logger.error("fatal", { error: String(err) });
    console.error("Fatal error:", err);
    process.exit(1);
  });
} else if (transport === "remote") {
  runRemote().catch((err) => {
    logger.error("fatal", { error: String(err) });
    console.error("Fatal error:", err);
    process.exit(1);
  });
} else {
  runStdio().catch((err) => {
    logger.error("fatal", { error: String(err) });
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
