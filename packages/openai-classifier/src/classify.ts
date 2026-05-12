import OpenAI from 'openai';
import { DecisionAction, createLogger } from '@jak-shield/shared';
import type { ClassifierAdvice } from '@jak-shield/shared';
import { scanAndRedactObject } from '@jak-shield/dlp';
import { SYSTEM_PROMPT, buildUserMessage, type ClassifierInput } from './prompt.js';
import { classifierCacheGet, classifierCacheKey, classifierCacheSet } from './cache.js';

const log = createLogger('openai-classifier');

const TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS ?? 1500);
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

let client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export interface ClassifyOptions {
  /** If true, skip cache lookups (useful for tests). */
  bypassCache?: boolean;
  /** Override the per-call timeout. */
  timeoutMs?: number;
  /** Override the model id. */
  model?: string;
}

/**
 * Run the OpenAI risk classifier. NEVER throws — returns null on any failure.
 * Always PII-redacts args before sending. Honors the configured timeout.
 */
export async function classify(input: ClassifierInput, options: ClassifyOptions = {}): Promise<ClassifierAdvice | null> {
  const started = Date.now();

  const cacheKey = classifierCacheKey(input.toolName, input.redactedArgs);
  if (!options.bypassCache) {
    const cached = classifierCacheGet(cacheKey);
    if (cached) return cached;
  }

  const oai = getClient();
  if (!oai) {
    log.debug('OPENAI_API_KEY not set — classifier returning null (graceful degrade)');
    return null;
  }

  // Defense-in-depth: re-redact args before send. Caller may have skipped scanning.
  const redacted = scanAndRedactObject(input.redactedArgs).redacted;
  const safeInput: ClassifierInput = { ...input, redactedArgs: redacted };

  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const model = options.model ?? MODEL;

  try {
    const advice = await withTimeout(
      oai.chat.completions.create({
        model,
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 300,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserMessage(safeInput) },
        ],
      }),
      timeoutMs,
    );

    const text = advice.choices[0]?.message?.content;
    if (!text) {
      log.warn('classifier returned empty content');
      return null;
    }
    const parsed = parseAdvice(text, Date.now() - started);
    if (parsed) classifierCacheSet(cacheKey, parsed);
    return parsed;
  } catch (err) {
    const elapsed = Date.now() - started;
    if ((err as Error).message === 'timeout') {
      log.warn(`classifier timed out after ${elapsed}ms`);
    } else {
      log.warn('classifier failed', (err as Error).message);
    }
    return null;
  }
}

function parseAdvice(text: string, latencyMs: number): ClassifierAdvice | null {
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    const risk = clamp01(Number(obj['risk']));
    const intentClass = String(obj['intentClass'] ?? 'unknown');
    const suggestedRaw = String(obj['suggestedAction'] ?? 'allow').toLowerCase();
    const suggestedAction = (Object.values(DecisionAction).find((d) => d === suggestedRaw) ?? DecisionAction.ALLOW) as DecisionAction;
    const rationale = String(obj['rationale'] ?? '').slice(0, 400);
    const safeRewrite = obj['safeRewrite'] != null ? String(obj['safeRewrite']) : undefined;
    return {
      risk,
      intentClass,
      suggestedAction,
      rationale,
      safeRewrite,
      source: 'openai',
      latencyMs,
    };
  } catch (err) {
    log.warn('classifier returned non-JSON', err);
    return null;
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function isClassifierConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
