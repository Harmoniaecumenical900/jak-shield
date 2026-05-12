/**
 * Behavioral anomaly detection v2.
 *
 *  - Multi-window rolling counters: 1 min, 5 min, 1 h, 24 h.
 *  - EWMA-tracked baseline per (tenant, agent, tool, window).
 *  - z-score detector — fires when current 1-min rate exceeds baseline by ≥ 3σ.
 *  - Burst detector — N calls in 60 s.
 *  - First-seen-destructive — never-before-used destructive/external tool.
 *  - Per-agent baselines, falling back to per-tenant when agentId missing.
 *
 * Still in-memory (single-process). exportSnapshot / importSnapshot exposed
 * so a deployment can plug in Redis/Postgres later without changing callers.
 */

export interface AnomalySignal {
  detected: boolean;
  score: number;
  reason: string;
  observed: number;
  baseline: number;
  zScore?: number;
  signalKind: 'burst' | 'spike' | 'first-seen' | 'none';
}

type WindowName = '1m' | '5m' | '1h' | '24h';

interface WindowStats {
  ts: number[];
  ewmaMean: number;
  ewmaVar: number;
  lastUpdate: number;
}

interface ToolStats {
  windows: Record<WindowName, WindowStats>;
  firstSeen: number;
  totalCalls: number;
}

const WINDOW_MS: Record<WindowName, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

const EWMA_ALPHA = 0.2;
const BURST_WINDOW_MS = 60 * 1000;
const BURST_THRESHOLD_DESTRUCTIVE = 5;
const BURST_THRESHOLD_OTHER = 20;
const Z_SCORE_THRESHOLD = 3.0;
const FIRST_SEEN_GRACE_MS = 24 * 60 * 60 * 1000;

const STORE = new Map<string, Map<string, ToolStats>>();

function key(tenantId: string, agentId: string | undefined): string {
  return `${tenantId}::${agentId ?? '_'}`;
}

function blankWindows(): Record<WindowName, WindowStats> {
  return {
    '1m': { ts: [], ewmaMean: 0, ewmaVar: 0, lastUpdate: 0 },
    '5m': { ts: [], ewmaMean: 0, ewmaVar: 0, lastUpdate: 0 },
    '1h': { ts: [], ewmaMean: 0, ewmaVar: 0, lastUpdate: 0 },
    '24h': { ts: [], ewmaMean: 0, ewmaVar: 0, lastUpdate: 0 },
  };
}

function getToolStats(tenantId: string, agentId: string | undefined, toolName: string): ToolStats {
  const k = key(tenantId, agentId);
  let bucket = STORE.get(k);
  if (!bucket) {
    bucket = new Map();
    STORE.set(k, bucket);
  }
  let s = bucket.get(toolName);
  if (!s) {
    s = { windows: blankWindows(), firstSeen: 0, totalCalls: 0 };
    bucket.set(toolName, s);
  }
  return s;
}

function pruneWindow(window: WindowStats, maxAge: number): void {
  const cutoff = Date.now() - maxAge;
  window.ts = window.ts.filter((t) => t >= cutoff);
}

function updateEwma(window: WindowStats, observed: number): void {
  const prevMean = window.ewmaMean;
  window.ewmaMean = (1 - EWMA_ALPHA) * window.ewmaMean + EWMA_ALPHA * observed;
  const delta = observed - prevMean;
  window.ewmaVar = (1 - EWMA_ALPHA) * window.ewmaVar + EWMA_ALPHA * (delta * delta);
  window.lastUpdate = Date.now();
}

export function recordCall(tenantId: string, toolName: string, agentId?: string): void {
  const s = getToolStats(tenantId, agentId, toolName);
  const now = Date.now();
  if (s.firstSeen === 0) s.firstSeen = now;
  s.totalCalls++;
  for (const w of Object.keys(s.windows) as WindowName[]) {
    pruneWindow(s.windows[w], WINDOW_MS[w]);
    s.windows[w].ts.push(now);
    updateEwma(s.windows[w], s.windows[w].ts.length);
  }
}

export function evaluateAnomaly(
  tenantId: string,
  toolName: string,
  toolRiskClass: 'READ_ONLY' | 'WRITE' | 'EXTERNAL_SIDE_EFFECT' | 'DESTRUCTIVE',
  agentId?: string,
): AnomalySignal {
  const s = getToolStats(tenantId, agentId, toolName);
  const now = Date.now();
  for (const w of Object.keys(s.windows) as WindowName[]) pruneWindow(s.windows[w], WINDOW_MS[w]);

  // 1) Burst detector — N calls within 60s.
  const burstThreshold =
    toolRiskClass === 'DESTRUCTIVE' || toolRiskClass === 'EXTERNAL_SIDE_EFFECT'
      ? BURST_THRESHOLD_DESTRUCTIVE
      : BURST_THRESHOLD_OTHER;
  const burstCount = s.windows['1m'].ts.filter((t) => t >= now - BURST_WINDOW_MS).length;
  if (burstCount >= burstThreshold) {
    return {
      detected: true,
      score: Math.min(1, burstCount / (burstThreshold * 2)),
      reason: `Burst: ${burstCount} calls to ${toolName} in last 60s (threshold ${burstThreshold})`,
      observed: burstCount,
      baseline: burstThreshold,
      signalKind: 'burst',
    };
  }

  // 2) First-seen destructive within grace window.
  if (
    s.totalCalls === 1 &&
    (toolRiskClass === 'DESTRUCTIVE' || toolRiskClass === 'EXTERNAL_SIDE_EFFECT') &&
    now - s.firstSeen < FIRST_SEEN_GRACE_MS
  ) {
    return {
      detected: true,
      score: 0.55,
      reason: `First-seen ${toolRiskClass} tool '${toolName}' for ${agentId ? `agent ${agentId}` : `tenant ${tenantId}`}`,
      observed: 1,
      baseline: 0,
      signalKind: 'first-seen',
    };
  }

  // 3) z-score spike — 1-min projected rate vs 1-hour EWMA baseline.
  const last1m = s.windows['1m'].ts.length;
  const hourly = s.windows['1h'];
  if (s.totalCalls > 10 && hourly.ewmaVar > 0) {
    const stdDev = Math.sqrt(hourly.ewmaVar);
    const projectedHourly = last1m * 60;
    const z = (projectedHourly - hourly.ewmaMean) / Math.max(stdDev, 1);
    if (z >= Z_SCORE_THRESHOLD) {
      return {
        detected: true,
        score: Math.min(1, z / 10),
        reason: `Spike: projected ${projectedHourly}/h vs baseline ${hourly.ewmaMean.toFixed(1)}/h (z=${z.toFixed(2)})`,
        observed: projectedHourly,
        baseline: Math.round(hourly.ewmaMean),
        zScore: z,
        signalKind: 'spike',
      };
    }
  }

  return { detected: false, score: 0, reason: '', observed: 0, baseline: 0, signalKind: 'none' };
}

export function resetAnomalyState(tenantId?: string, agentId?: string): void {
  if (!tenantId) {
    STORE.clear();
    return;
  }
  STORE.delete(key(tenantId, agentId));
}

export function anomalySnapshot(
  tenantId: string,
  agentId?: string,
): Record<string, { totalCalls: number; last1m: number; last1h: number; ewmaMean1h: number }> {
  const bucket = STORE.get(key(tenantId, agentId));
  if (!bucket) return {};
  const out: Record<string, { totalCalls: number; last1m: number; last1h: number; ewmaMean1h: number }> = {};
  for (const [tool, s] of bucket.entries()) {
    out[tool] = {
      totalCalls: s.totalCalls,
      last1m: s.windows['1m'].ts.length,
      last1h: s.windows['1h'].ts.length,
      ewmaMean1h: s.windows['1h'].ewmaMean,
    };
  }
  return out;
}

export function exportSnapshot(): unknown {
  const out: Record<string, unknown> = {};
  for (const [k, bucket] of STORE.entries()) {
    out[k] = Object.fromEntries(bucket);
  }
  return out;
}

export function importSnapshot(snapshot: unknown): void {
  if (!snapshot || typeof snapshot !== 'object') return;
  STORE.clear();
  for (const [k, bucket] of Object.entries(snapshot as Record<string, Record<string, ToolStats>>)) {
    const map = new Map<string, ToolStats>(Object.entries(bucket));
    STORE.set(k, map);
  }
}
