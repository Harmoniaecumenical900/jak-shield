/**
 * Cross-call attack-chain detection v2.
 *
 *  - 20 hand-crafted multi-step patterns covering exfil, harvest, recon-destroy,
 *    spam burst, credential abuse, configuration-leak, lateral pivot, prompt-injection
 *    chains, and supply-chain-style attacks.
 *  - Data-flow tracking: a chain match is upgraded to high confidence when an output
 *    field from step N appears in args of step N+1.
 *  - Time-decay weighting: chains that span more than CHAIN_WINDOW_MS lose effect.
 *  - Per-pattern confidence scoring.
 */

export interface ChainPattern {
  id: string;
  description: string;
  /** Ordered sequence of regex strings matched against tool names. */
  steps: RegExp[];
  /** Optional predicate over the current call's args. */
  trigger?: (args: Record<string, unknown>) => boolean;
  /** Severity multiplier (0..1). */
  severity: number;
  /** ATT&CK-style tactic tag for filtering. */
  tactic?: 'exfiltration' | 'destruction' | 'recon' | 'lateral' | 'collection' | 'credential' | 'config-leak' | 'injection-chain' | 'spam';
}

export const ATTACK_CHAINS: ChainPattern[] = [
  // ── Credential harvest (specific — must come before generic exfil) ───
  {
    id: 'credential-harvest',
    description: 'Read sensitive paths (.env, .aws, .ssh) then post outbound',
    steps: [/^filesystem\.(read|list)$/, /^(webhook\.send|http\.post|gmail\.send_email)$/],
    trigger: (args) => {
      const s = JSON.stringify(args).toLowerCase();
      return s.includes('.env') || s.includes('credential') || s.includes('.ssh') || s.includes('id_rsa') || s.includes('.aws');
    },
    severity: 1.0,
    tactic: 'credential',
  },
  {
    id: 'env-leak',
    description: 'Read .env / process env then expose',
    steps: [/^(filesystem\.read|shell\.run)$/, /^(http\.post|webhook\.send|gmail\.send_email|slack\.send_message)$/],
    trigger: (args) => {
      const s = JSON.stringify(args).toLowerCase();
      return /\benv\b|\.env|environment/.test(s);
    },
    severity: 0.95,
    tactic: 'credential',
  },

  // ── Exfiltration (generic) ────────────────────────────────────────────
  {
    id: 'read-pii-then-exfiltrate',
    description: 'Read PII-laden data then send through public sink',
    steps: [
      /^(filesystem\.read|gmail\.read_email|postgres\.query|supabase\.select)$/,
      /^(gmail\.send_email|slack\.send_message|sms\.send|webhook\.send|http\.post)$/,
    ],
    severity: 0.9,
    tactic: 'exfiltration',
  },
  {
    id: 'browser-then-internal-action',
    description: 'Untrusted browser content used in a sensitive sink',
    steps: [
      /^(browser\.fetch|http\.fetch)$/,
      /^(gmail\.send_email|slack\.send_message|webhook\.send|http\.post|postgres\.query|supabase\.query|github\.create_issue|github\.create_pr_comment)$/,
    ],
    severity: 0.9,
    tactic: 'injection-chain',
  },
  {
    id: 'db-then-webhook',
    description: 'Database read followed by an outbound webhook',
    steps: [/^(postgres\.query|supabase\.select)$/, /^webhook\.send$/],
    severity: 0.85,
    tactic: 'exfiltration',
  },
  {
    id: 'drive-then-public-share',
    description: 'Google Drive read then social/webhook post',
    steps: [/^gdrive\.(list|read)$/, /^(social\.publish_with_approval|webhook\.send|http\.post)$/],
    severity: 0.85,
    tactic: 'exfiltration',
  },

  // ── Recon → destroy ───────────────────────────────────────────────────
  {
    id: 'recon-then-destroy',
    description: 'Inventory then destructive op',
    steps: [
      /^(supabase\.select|postgres\.query|filesystem\.list)$/,
      /^(postgres\.query|supabase\.query|filesystem\.delete|shell\.run)$/,
    ],
    trigger: (args) => /\b(drop|truncate|delete from|rm\s+-rf)\b/i.test(JSON.stringify(args)),
    severity: 1.0,
    tactic: 'destruction',
  },
  {
    id: 'inventory-then-mass-delete',
    description: 'List many resources then iterate-delete pattern',
    steps: [/^(filesystem\.list|github\.list_repos|gmail\.list_messages)$/, /^(filesystem\.delete|github\.delete_branch)$/],
    severity: 0.85,
    tactic: 'destruction',
  },

  // ── Configuration / secret leak ───────────────────────────────────────
  {
    id: 'config-then-share',
    description: 'Read repo / connector config then share externally',
    steps: [/^(filesystem\.read|github\.list_repos)$/, /^(slack\.send_message|webhook\.send|gmail\.send_email|http\.post)$/],
    trigger: (args) => /config|settings|token|api_key|secret/i.test(JSON.stringify(args)),
    severity: 0.9,
    tactic: 'config-leak',
  },

  // ── Prompt-injection chains ───────────────────────────────────────────
  {
    id: 'fetch-then-act-on-content',
    description: 'Fetch a URL then take action whose args reference fetched text',
    steps: [/^(browser\.fetch|http\.fetch)$/, /^(postgres\.query|supabase\.query|shell\.run|filesystem\.write)$/],
    severity: 0.85,
    tactic: 'injection-chain',
  },
  {
    id: 'email-then-act',
    description: 'Read inbound email then act on its content',
    steps: [/^gmail\.(read_email|list_messages)$/, /^(postgres\.query|supabase\.query|shell\.run|webhook\.send)$/],
    severity: 0.85,
    tactic: 'injection-chain',
  },

  // ── Spam / abuse ──────────────────────────────────────────────────────
  {
    id: 'social-spam-burst',
    description: 'Repeated social drafts then publish — possible spam burst',
    steps: [/^social\.create_draft$/, /^social\.create_draft$/, /^social\.publish_with_approval$/],
    severity: 0.7,
    tactic: 'spam',
  },
  {
    id: 'bulk-outbound-burst',
    description: 'Three or more outbound messages in succession',
    steps: [
      /^(gmail\.send_email|slack\.send_message|sms\.send|webhook\.send)$/,
      /^(gmail\.send_email|slack\.send_message|sms\.send|webhook\.send)$/,
      /^(gmail\.send_email|slack\.send_message|sms\.send|webhook\.send)$/,
    ],
    severity: 0.75,
    tactic: 'spam',
  },

  // ── Lateral / privilege ───────────────────────────────────────────────
  {
    id: 'shell-then-network-fetch',
    description: 'Shell command then outbound network call',
    steps: [/^shell\.run$/, /^(http\.fetch|http\.post|webhook\.send)$/],
    severity: 0.8,
    tactic: 'lateral',
  },
  {
    id: 'github-write-then-deploy',
    description: 'GitHub write action then production deployment',
    steps: [/^github\.(create_issue|create_pr_comment|merge_pr)$/, /^deploy$/],
    severity: 0.9,
    tactic: 'lateral',
  },

  // ── Collection ────────────────────────────────────────────────────────
  {
    id: 'mass-read-then-bundle',
    description: 'Read many files / messages then write a single bundle',
    steps: [/^(filesystem\.read|filesystem\.list|gmail\.list_messages|postgres\.query)$/, /^filesystem\.write$/],
    trigger: (args) => /bundle|archive|export|dump|backup/i.test(JSON.stringify(args)),
    severity: 0.7,
    tactic: 'collection',
  },

  // ── Multi-step destructive SQL ────────────────────────────────────────
  {
    id: 'select-then-delete',
    description: 'SELECT ids then DELETE / UPDATE without WHERE',
    steps: [/^(postgres\.query|supabase\.query|supabase\.select)$/, /^(postgres\.query|supabase\.query)$/],
    trigger: (args) => /\b(delete\s+from|update\s+.+\s+set)\b/i.test(JSON.stringify(args)) && !/\bwhere\b/i.test(JSON.stringify(args)),
    severity: 0.85,
    tactic: 'destruction',
  },

  // ── Token / credential abuse via shell ────────────────────────────────
  {
    id: 'shell-fetch-eval',
    description: 'Shell-fetch then eval pattern (curl | bash, etc.)',
    steps: [/^shell\.run$/, /^shell\.run$/],
    trigger: (args) => /\b(curl|wget)\b.+\|\s*(?:bash|sh|zsh|python)/i.test(JSON.stringify(args)),
    severity: 0.95,
    tactic: 'lateral',
  },

  // ── Data-poisoning ────────────────────────────────────────────────────
  {
    id: 'browser-then-db-write',
    description: 'Untrusted web content written into a database',
    steps: [/^(browser\.fetch|http\.fetch)$/, /^(postgres\.query|supabase\.query|supabase\.select)$/],
    trigger: (args) => /\b(insert|update|upsert)\b/i.test(JSON.stringify(args)),
    severity: 0.9,
    tactic: 'injection-chain',
  },
];

interface SessionHistory {
  calls: { tool: string; ts: number; outputs?: string }[];
}

const HISTORY = new Map<string, SessionHistory>();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_HISTORY = 50;

export function recordSessionCall(sessionId: string, toolName: string, output?: string): void {
  const h = HISTORY.get(sessionId) ?? { calls: [] };
  const cutoff = Date.now() - WINDOW_MS;
  h.calls = h.calls.filter((c) => c.ts >= cutoff);
  h.calls.push({ tool: toolName, ts: Date.now(), outputs: output?.slice(0, 1000) });
  if (h.calls.length > MAX_HISTORY) h.calls.shift();
  HISTORY.set(sessionId, h);
}

export interface ChainMatch {
  matched: ChainPattern | null;
  recentTools: string[];
  /** 0..1 — combined severity × data-flow boost × time-decay. */
  confidence: number;
  /** Whether the current args reference output from a previous step. */
  dataFlow: boolean;
}

export function detectAttackChain(
  sessionId: string,
  currentTool: string,
  currentArgs: Record<string, unknown>,
): ChainMatch {
  const h = HISTORY.get(sessionId);
  const recentTools = (h?.calls ?? []).map((c) => c.tool);
  const sequence =
    recentTools.length > 0 && recentTools[recentTools.length - 1] === currentTool
      ? recentTools
      : [...recentTools, currentTool];

  if (sequence.length < 2) return { matched: null, recentTools, confidence: 0, dataFlow: false };

  const now = Date.now();
  const argsStr = JSON.stringify(currentArgs ?? {});

  for (const chain of ATTACK_CHAINS) {
    if (chain.steps.length > sequence.length) continue;
    const tail = sequence.slice(-chain.steps.length);
    const matches = chain.steps.every((re, i) => re.test(tail[i] ?? ''));
    if (!matches) continue;
    if (chain.trigger && !chain.trigger(currentArgs)) continue;

    // Data-flow boost: did a prior step's output appear in current args?
    let dataFlow = false;
    const allCalls = h?.calls ?? [];
    // Drop the trailing entry only if it IS the current call (i.e. caller already recorded).
    const priorCalls =
      allCalls.length > 0 && allCalls[allCalls.length - 1]?.tool === currentTool
        ? allCalls.slice(0, -1)
        : allCalls;
    for (const prior of priorCalls) {
      if (!prior.outputs) continue;
      // Look for any contiguous 30+ char substring of the prior output in current args.
      const out = prior.outputs;
      for (let i = 0; i + 30 <= out.length; i += 30) {
        const slice = out.slice(i, i + 30);
        if (argsStr.includes(slice)) {
          dataFlow = true;
          break;
        }
      }
      if (dataFlow) break;
    }

    // Time-decay: chains that span less than 60s get full weight, decaying to 0.5 over 5 min.
    const span = priorCalls.length > 0 ? now - priorCalls[0]!.ts : 0;
    const decay = Math.max(0.5, 1 - (span - 60_000) / (5 * 60_000));

    const confidence = Math.min(1, chain.severity * decay * (dataFlow ? 1.0 : 0.85));

    return { matched: chain, recentTools, confidence, dataFlow };
  }

  return { matched: null, recentTools, confidence: 0, dataFlow: false };
}

export function clearSessionHistory(sessionId: string): void {
  HISTORY.delete(sessionId);
}

export function sessionHistorySnapshot(sessionId: string): { calls: { tool: string; ts: number }[] } {
  const h = HISTORY.get(sessionId);
  return { calls: (h?.calls ?? []).map((c) => ({ tool: c.tool, ts: c.ts })) };
}
