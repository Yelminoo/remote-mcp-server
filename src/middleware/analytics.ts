import { Request, Response, NextFunction } from "express";
import { metrics } from "../services/metrics.js";
import { logger } from "../services/logger.js";

// Skip internal/monitoring paths so they don't pollute analytics or logs
function shouldSkip(path: string): boolean {
  return path === "/health"
    || path.startsWith("/dashboard")
    || path.startsWith("/api/metrics");
}

export function analyticsMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (shouldSkip(req.path)) { next(); return; }
  const start = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const { method, path } = req;
    const status = res.statusCode;
    metrics.record({ method, path, status, durationMs });
    logger.request(method, path, status, durationMs);
  });
  next();
}
