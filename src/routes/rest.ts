import { Router } from "express";
import { z } from "zod";
import { get, post, put, del, sanitizePath } from "../services/api-client.js";
import { metrics } from "../services/metrics.js";
import { saveCredentials, getStatus } from "../services/credentials.js";
import { logger } from "../services/logger.js";
import { listTools, createTool, updateTool, deleteTool } from "../services/tool-store.js";

// ─────────────────────────────────────────────
// TRELLO REST ROUTER
// Thin HTTP wrapper over the same Trello API calls the MCP tools use.
// Auth (key + token) is injected automatically by api-client.ts.
// ─────────────────────────────────────────────

const CreateCardSchema = z.object({
  idList: z.string().min(1),
  name: z.string().min(1).max(16384),
  desc: z.string().max(16384).optional(),
  due: z.string().optional(),
  pos: z.enum(["top", "bottom"]).default("bottom"),
});

const UpdateCardSchema = z.object({
  name: z.string().min(1).max(16384).optional(),
  desc: z.string().max(16384).optional(),
  due: z.string().nullable().optional(),
  dueComplete: z.boolean().optional(),
  idList: z.string().optional(),
  closed: z.boolean().optional(),
  pos: z.union([z.enum(["top", "bottom"]), z.number().positive()]).optional(),
}).refine(b => Object.keys(b).length > 0, { message: "At least one field required" });

const CreateListSchema = z.object({
  idBoard: z.string().min(1),
  name: z.string().min(1).max(200),
  pos: z.enum(["top", "bottom"]).default("bottom"),
});

function handleError(res: import("express").Response, err: unknown): void {
  const e = err as { status?: number; message: string };
  res.status(e.status ?? 500).json({ error: e.message });
}

export function createRestRouter(): Router {
  const router = Router();

  // ── Member ───────────────────────────────────

  // GET /api/me
  router.get("/me", async (_req, res) => {
    try {
      const data = await get("/members/me", { fields: "username,fullName,url" });
      res.json(data);
    } catch (err) { handleError(res, err); }
  });

  // ── Boards ───────────────────────────────────

  // GET /api/boards?filter=open
  router.get("/boards", async (req, res) => {
    const filter = String(req.query.filter ?? "open");
    try {
      const data = await get("/members/me/boards", {
        fields: "name,desc,closed,url,shortUrl",
        filter,
      });
      res.json(data);
    } catch (err) { handleError(res, err); }
  });

  // GET /api/boards/:id
  router.get("/boards/:id", async (req, res) => {
    const id = sanitizePath(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
    try {
      const data = await get(`/boards/${id}`, { fields: "name,desc,closed,url,shortUrl" });
      res.json(data);
    } catch (err) { handleError(res, err); }
  });

  // GET /api/boards/:id/lists?filter=open
  router.get("/boards/:id/lists", async (req, res) => {
    const id = sanitizePath(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
    const filter = String(req.query.filter ?? "open");
    try {
      const data = await get(`/boards/${id}/lists`, { filter, fields: "name,pos,closed" });
      res.json(data);
    } catch (err) { handleError(res, err); }
  });

  // GET /api/boards/:id/cards?filter=open
  router.get("/boards/:id/cards", async (req, res) => {
    const id = sanitizePath(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
    const filter = String(req.query.filter ?? "open");
    try {
      const data = await get(`/boards/${id}/cards`, {
        filter,
        fields: "name,desc,due,dueComplete,idList,shortUrl,labels",
      });
      res.json(data);
    } catch (err) { handleError(res, err); }
  });

  // ── Lists ────────────────────────────────────

  // GET /api/lists/:id/cards?filter=open
  router.get("/lists/:id/cards", async (req, res) => {
    const id = sanitizePath(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
    const filter = String(req.query.filter ?? "open");
    try {
      const data = await get(`/lists/${id}/cards`, {
        filter,
        fields: "name,desc,due,dueComplete,shortUrl,labels",
      });
      res.json(data);
    } catch (err) { handleError(res, err); }
  });

  // POST /api/lists  { idBoard, name, pos }
  router.post("/lists", async (req, res) => {
    const parsed = CreateListSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
    try {
      const data = await post("/lists", parsed.data);
      res.status(201).json(data);
    } catch (err) { handleError(res, err); }
  });

  // PUT /api/lists/:id  { name?, closed? }
  router.put("/lists/:id", async (req, res) => {
    const id = sanitizePath(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
    try {
      const data = await put(`/lists/${id}`, req.body);
      res.json(data);
    } catch (err) { handleError(res, err); }
  });

  // ── Cards ────────────────────────────────────

  // GET /api/cards/:id
  router.get("/cards/:id", async (req, res) => {
    const id = sanitizePath(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
    try {
      const data = await get(`/cards/${id}`, {
        fields: "name,desc,due,dueComplete,closed,idList,idBoard,url,shortUrl,labels,pos",
      });
      res.json(data);
    } catch (err) { handleError(res, err); }
  });

  // POST /api/cards  { idList, name, desc?, due?, pos? }
  router.post("/cards", async (req, res) => {
    const parsed = CreateCardSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
    try {
      const data = await post("/cards", parsed.data);
      res.status(201).json(data);
    } catch (err) { handleError(res, err); }
  });

  // PUT /api/cards/:id  { name?, desc?, due?, dueComplete?, idList?, closed?, pos? }
  router.put("/cards/:id", async (req, res) => {
    const id = sanitizePath(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
    const parsed = UpdateCardSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
    try {
      const data = await put(`/cards/${id}`, parsed.data);
      res.json(data);
    } catch (err) { handleError(res, err); }
  });

  // DELETE /api/cards/:id
  router.delete("/cards/:id", async (req, res) => {
    const id = sanitizePath(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
    try {
      await del(`/cards/${id}`);
      res.status(204).send();
    } catch (err) { handleError(res, err); }
  });

  // POST /api/cards/:id/comments  { text }
  router.post("/cards/:id/comments", async (req, res) => {
    const id = sanitizePath(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
    const text = String(req.body?.text ?? "").trim();
    if (!text) { res.status(400).json({ error: "text is required" }); return; }
    try {
      const data = await post(`/cards/${id}/actions/comments`, { text });
      res.status(201).json(data);
    } catch (err) { handleError(res, err); }
  });

  // ── Search ───────────────────────────────────

  // GET /api/search?q=...&cards_limit=10&boards_limit=5
  router.get("/search", async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (!q) { res.status(400).json({ error: "q is required" }); return; }
    const cardsLimit  = Math.min(Number(req.query.cards_limit  ?? 10), 50);
    const boardsLimit = Math.min(Number(req.query.boards_limit ?? 5),  10);
    try {
      const data = await get("/search", {
        query: q,
        modelTypes: "cards,boards",
        card_fields: "name,shortUrl,idList,idBoard",
        board_fields: "name,shortUrl",
        cards_limit: isNaN(cardsLimit)  ? 10 : cardsLimit,
        boards_limit: isNaN(boardsLimit) ? 5  : boardsLimit,
      });
      res.json(data);
    } catch (err) { handleError(res, err); }
  });

  // ── Credentials (local — never returns real values) ──

  // GET /api/credentials/status
  router.get("/credentials/status", (_req, res) => {
    res.json(getStatus());
  });

  // POST /api/credentials  { apiKey, apiToken }
  // Writes to ~/.trello-mcp/credentials.json with mode 0o600.
  // Only accessible from localhost (enforced by BIND_HOST + Origin check in app).
  router.post("/credentials", (req, res) => {
    const schema = z.object({
      apiKey:   z.string().min(1, "apiKey is required"),
      apiToken: z.string().min(1, "apiToken is required"),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    try {
      saveCredentials(parsed.data.apiKey, parsed.data.apiToken);
      logger.info("credentials_saved", { source: "file" });
      // Return only masked values — full credentials never leave the server
      res.json({ ok: true, ...getStatus() });
    } catch (err) {
      res.status(500).json({ error: "Failed to save credentials: " + (err as Error).message });
    }
  });

  // GET /api/credentials/test — verifies credentials work against Trello
  router.get("/credentials/test", async (_req, res) => {
    try {
      const member = await get<{ username: string; fullName: string }>("/members/me", {
        fields: "username,fullName",
      });
      res.json({ ok: true, username: member.username, fullName: member.fullName });
    } catch (err) {
      const e = err as { message: string };
      res.json({ ok: false, error: e.message });
    }
  });

  // ── Server info ──────────────────────────────

  // GET /api/server-info
  router.get("/server-info", (_req, res) => {
    const mode = process.env.TRANSPORT ?? "stdio";
    const port = parseInt(process.env.PORT ?? (mode === "remote" ? "3001" : "3000"));
    res.json({
      transport: mode,
      port,
      hasAuth: !!(process.env.MCP_AUTH_TOKEN?.trim()),
    });
  });

  // ── Custom Tool Builder ──────────────────────

  // GET /api/tools
  router.get("/tools", (_req, res) => {
    res.json(listTools());
  });

  // POST /api/tools  { name, title, description, method, url, headers?, params?, ... }
  router.post("/tools", (req, res) => {
    try {
      const tool = createTool(req.body);
      res.status(201).json(tool);
    } catch (err) {
      const e = err as Error;
      const status = e.message.includes("already in use") ? 409 : 400;
      res.status(status).json({ error: e.message });
    }
  });

  // PUT /api/tools/:id
  router.put("/tools/:id", (req, res) => {
    try {
      const tool = updateTool(req.params.id, req.body);
      res.json(tool);
    } catch (err) {
      const e = err as Error;
      const status = e.message === "Tool not found" ? 404 : e.message.includes("already in use") ? 409 : 400;
      res.status(status).json({ error: e.message });
    }
  });

  // DELETE /api/tools/:id
  router.delete("/tools/:id", (req, res) => {
    const ok = deleteTool(req.params.id);
    if (!ok) { res.status(404).json({ error: "Tool not found" }); return; }
    res.status(204).send();
  });

  // ── Metrics (local) ──────────────────────────

  // GET /api/metrics
  router.get("/metrics", (_req, res) => {
    res.json(metrics.getStats());
  });

  // GET /api/metrics/recent?n=50
  router.get("/metrics/recent", (req, res) => {
    const n = Number(req.query.n ?? 50);
    res.json(metrics.getRecent(!isNaN(n) && n > 0 && n <= 200 ? n : 50));
  });

  return router;
}
