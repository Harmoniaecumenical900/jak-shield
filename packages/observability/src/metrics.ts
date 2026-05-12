/**
 * In-process Prometheus metrics — no dependency on prom-client so this package
 * stays small. Implements counter, gauge, histogram with the exposition format.
 *
 * Histograms use fixed buckets (5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000 ms).
 * That covers expected decision/connector latency ranges.
 */

type Labels = Record<string, string>;

interface CounterState {
  values: Map<string, number>;
  help: string;
}

interface GaugeState {
  values: Map<string, number>;
  help: string;
}

interface HistogramState {
  buckets: number[];
  counts: Map<string, number[]>; // labels-key → bucket counts
  sums: Map<string, number>;
  totals: Map<string, number>;
  help: string;
}

const COUNTERS = new Map<string, CounterState>();
const GAUGES = new Map<string, GaugeState>();
const HISTOGRAMS = new Map<string, HistogramState>();

const DEFAULT_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

function labelKey(labels?: Labels): string {
  if (!labels) return '';
  const keys = Object.keys(labels).sort();
  return keys.map((k) => `${k}="${labels[k]?.replace(/"/g, '\\"') ?? ''}"`).join(',');
}

export function counter(name: string, help: string): {
  inc: (labels?: Labels, value?: number) => void;
  reset: () => void;
} {
  if (!COUNTERS.has(name)) COUNTERS.set(name, { values: new Map(), help });
  const c = COUNTERS.get(name)!;
  return {
    inc(labels?: Labels, value = 1) {
      const k = labelKey(labels);
      c.values.set(k, (c.values.get(k) ?? 0) + value);
    },
    reset() {
      c.values.clear();
    },
  };
}

export function gauge(name: string, help: string): {
  set: (value: number, labels?: Labels) => void;
  inc: (value: number, labels?: Labels) => void;
  dec: (value: number, labels?: Labels) => void;
} {
  if (!GAUGES.has(name)) GAUGES.set(name, { values: new Map(), help });
  const g = GAUGES.get(name)!;
  return {
    set(value, labels) {
      g.values.set(labelKey(labels), value);
    },
    inc(value, labels) {
      const k = labelKey(labels);
      g.values.set(k, (g.values.get(k) ?? 0) + value);
    },
    dec(value, labels) {
      const k = labelKey(labels);
      g.values.set(k, (g.values.get(k) ?? 0) - value);
    },
  };
}

export function histogram(
  name: string,
  help: string,
  buckets: number[] = DEFAULT_BUCKETS_MS,
): { observe: (value: number, labels?: Labels) => void } {
  if (!HISTOGRAMS.has(name)) {
    HISTOGRAMS.set(name, { buckets: [...buckets].sort((a, b) => a - b), counts: new Map(), sums: new Map(), totals: new Map(), help });
  }
  const h = HISTOGRAMS.get(name)!;
  return {
    observe(value, labels) {
      const k = labelKey(labels);
      if (!h.counts.has(k)) h.counts.set(k, h.buckets.map(() => 0));
      const counts = h.counts.get(k)!;
      for (let i = 0; i < h.buckets.length; i++) if (value <= h.buckets[i]!) counts[i]!++;
      h.sums.set(k, (h.sums.get(k) ?? 0) + value);
      h.totals.set(k, (h.totals.get(k) ?? 0) + 1);
    },
  };
}

/** Render the full registry in Prometheus exposition format. */
export function renderPrometheus(): string {
  const out: string[] = [];

  for (const [name, c] of COUNTERS.entries()) {
    out.push(`# HELP ${name} ${c.help}`);
    out.push(`# TYPE ${name} counter`);
    if (c.values.size === 0) out.push(`${name} 0`);
    for (const [k, v] of c.values.entries()) out.push(k ? `${name}{${k}} ${v}` : `${name} ${v}`);
  }

  for (const [name, g] of GAUGES.entries()) {
    out.push(`# HELP ${name} ${g.help}`);
    out.push(`# TYPE ${name} gauge`);
    if (g.values.size === 0) out.push(`${name} 0`);
    for (const [k, v] of g.values.entries()) out.push(k ? `${name}{${k}} ${v}` : `${name} ${v}`);
  }

  for (const [name, h] of HISTOGRAMS.entries()) {
    out.push(`# HELP ${name} ${h.help}`);
    out.push(`# TYPE ${name} histogram`);
    for (const [k, counts] of h.counts.entries()) {
      const baseLabel = k ? `{${k}` : '{';
      let cumulative = 0;
      for (let i = 0; i < h.buckets.length; i++) {
        cumulative += counts[i]!;
        out.push(`${name}_bucket${baseLabel}${k ? ',' : ''}le="${h.buckets[i]}"} ${cumulative}`);
      }
      out.push(`${name}_bucket${baseLabel}${k ? ',' : ''}le="+Inf"} ${h.totals.get(k) ?? 0}`);
      out.push(`${name}_sum${k ? `{${k}}` : ''} ${h.sums.get(k) ?? 0}`);
      out.push(`${name}_count${k ? `{${k}}` : ''} ${h.totals.get(k) ?? 0}`);
    }
  }

  return out.join('\n') + '\n';
}

// ---- Pre-declared metrics used across the codebase ----

export const decisionCounter = counter('jak_shield_decisions_total', 'Policy decisions emitted, by action and rule');
export const decisionLatency = histogram('jak_shield_decision_latency_ms', 'Time to compute a decision (ms)');
export const connectorCounter = counter('jak_shield_connector_calls_total', 'Connector tool calls, by tool and outcome');
export const connectorLatency = histogram('jak_shield_connector_latency_ms', 'Connector execution latency (ms)');
export const classifierCounter = counter('jak_shield_classifier_calls_total', 'OpenAI classifier invocations, by outcome');
export const classifierLatency = histogram('jak_shield_classifier_latency_ms', 'Classifier latency (ms)');
export const approvalCounter = counter('jak_shield_approvals_total', 'Approval requests, by status');
export const piiFindingCounter = counter('jak_shield_pii_findings_total', 'PII findings emitted by type');
export const injectionCounter = counter('jak_shield_injection_detected_total', 'Injection detections by stage');
export const taintCounter = counter('jak_shield_taint_flow_total', 'Taint-flow events');
export const chainCounter = counter('jak_shield_attack_chains_total', 'Attack chains matched by id');
export const anomalyCounter = counter('jak_shield_anomalies_total', 'Anomaly signals by kind');
export const rateLimitCounter = counter('jak_shield_rate_limited_total', 'Rate-limited requests');
export const httpRequestCounter = counter('jak_shield_http_requests_total', 'HTTP requests by route and status');
export const activeApprovals = gauge('jak_shield_active_approvals', 'Approvals currently in PENDING state');
