export interface RequestRecord {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  ts: number;
}

export interface RouteSnapshot {
  key: string;
  calls: number;
  errors: number;
  avgMs: number;
  lastCalledAt: number;
}

export interface StatsSnapshot {
  uptimeMs: number;
  totalRequests: number;
  totalErrors: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
  byRoute: RouteSnapshot[];
}

interface RouteStats {
  calls: number;
  errors: number;
  totalMs: number;
  lastCalledAt: number;
  durations: number[];
}

const MAX_RECENT = 200;
const MAX_DURATIONS = 100;

class MetricsService {
  private readonly recent: RequestRecord[] = [];
  private readonly byRoute = new Map<string, RouteStats>();
  private readonly startedAt = Date.now();

  record(r: Omit<RequestRecord, "ts">): void {
    const record: RequestRecord = { ...r, ts: Date.now() };
    this.recent.push(record);
    if (this.recent.length > MAX_RECENT) this.recent.shift();

    const key = `${r.method} ${r.path}`;
    const s = this.byRoute.get(key) ?? { calls: 0, errors: 0, totalMs: 0, lastCalledAt: 0, durations: [] };
    s.calls++;
    s.totalMs += r.durationMs;
    s.lastCalledAt = record.ts;
    s.durations.push(r.durationMs);
    if (s.durations.length > MAX_DURATIONS) s.durations.shift();
    if (r.status >= 400) s.errors++;
    this.byRoute.set(key, s);
  }

  getStats(): StatsSnapshot {
    const allStats = Array.from(this.byRoute.values());
    const totalRequests = allStats.reduce((acc, s) => acc + s.calls, 0);
    const totalErrors = allStats.reduce((acc, s) => acc + s.errors, 0);
    const allDurations = allStats.flatMap(s => s.durations);
    const sorted = [...allDurations].sort((a, b) => a - b);

    return {
      uptimeMs: Date.now() - this.startedAt,
      totalRequests,
      totalErrors,
      avgLatencyMs: sorted.length ? Math.round(sorted.reduce((a, d) => a + d, 0) / sorted.length) : 0,
      p95LatencyMs: sorted.length ? (sorted[Math.floor(sorted.length * 0.95)] ?? 0) : 0,
      errorRate: totalRequests ? Math.round((totalErrors / totalRequests) * 100) : 0,
      byRoute: Array.from(this.byRoute.entries())
        .map(([key, s]) => ({
          key,
          calls: s.calls,
          errors: s.errors,
          avgMs: s.calls ? Math.round(s.totalMs / s.calls) : 0,
          lastCalledAt: s.lastCalledAt,
        }))
        .sort((a, b) => b.calls - a.calls),
    };
  }

  getRecent(n = 50): RequestRecord[] {
    return this.recent.slice(-n).reverse();
  }
}

export const metrics = new MetricsService();
