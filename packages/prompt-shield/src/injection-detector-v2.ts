/**
 * Defense-in-depth injection detector. Each stage emits its own evidence so
 * the policy engine sees not just "detected: true" but exactly which attack
 * vectors fired.
 *
 * Stages:
 *  1. STANDARD — the existing regex patterns (lifted from v1)
 *  2. STRUCTURAL — pull text out of HTML comments / hidden attrs / JSON system
 *                  roles BEFORE regex, so attackers can't hide instructions
 *                  in <!-- ignore previous instructions --> or
 *                  {"role":"system","content":"…"}
 *  3. UNICODE — strip confusables / zero-width / right-to-left override marks,
 *               re-scan the canonicalized text
 *  4. ENCODING — find base64 / hex / percent-encoded blobs, decode them, re-scan
 *  5. SPACED — collapse "I g n o r e   p r e v i o u s" → "Ignore previous"
 *              and re-scan
 *  6. MULTILINGUAL — pattern set translated to Spanish, French, German, Hindi,
 *                    Mandarin, Russian
 */

import { detectInjection as detectV1 } from './injection-detector.js';
import type { InjectionDetectionResult } from './injection-detector.js';
import { scanExtended } from './patterns-extended.js';

export interface InjectionEvidence {
  stage: 'standard' | 'structural' | 'unicode' | 'encoding' | 'spaced' | 'multilingual';
  pattern: string;
  risk: 'LOW' | 'HIGH';
  /** Where in the input it was found (line:col or path). */
  location?: string;
  /** Decoded form, if the stage decoded something. */
  decoded?: string;
}

export interface InjectionResultV2 {
  detected: boolean;
  risk: 'LOW' | 'HIGH';
  confidence: number;
  evidence: InjectionEvidence[];
  /** Canonicalized version of the input with confusables, zero-width chars,
   *  and spacing tricks neutralized. Safe to log; not safe to feed to a model. */
  canonical: string;
}

// ---------- 1. Standard layer ----------

function runStandard(text: string): InjectionEvidence[] {
  const r = detectV1(text);
  return r.patterns.map((p) => ({ stage: 'standard' as const, pattern: p, risk: r.risk }));
}

// ---------- 2. Structural layer ----------

const HTML_COMMENT = /<!--([\s\S]*?)-->/g;
const HTML_HIDDEN_ATTR = /\b(?:title|alt|aria-label|data-[a-z\-]+)\s*=\s*"([^"]+)"/gi;
const HTML_HIDDEN_INPUT = /<input[^>]+type=["']hidden["'][^>]+value=["']([^"']+)["']/gi;
const HTML_SCRIPT_BLOCK = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
const JSON_ROLE_INJECTION = /["']role["']\s*:\s*["']system["'][\s\S]{0,200}["']content["']\s*:\s*["']([^"']+)["']/gi;

function runStructural(text: string): InjectionEvidence[] {
  const out: InjectionEvidence[] = [];
  for (const [pattern, label, risk] of [
    [HTML_COMMENT, 'HTML comment payload', 'HIGH'] as const,
    [HTML_HIDDEN_ATTR, 'Hidden HTML attribute payload', 'HIGH'] as const,
    [HTML_HIDDEN_INPUT, 'Hidden HTML input value', 'HIGH'] as const,
    [HTML_SCRIPT_BLOCK, 'Inline <script> body', 'HIGH'] as const,
    [JSON_ROLE_INJECTION, 'Injected JSON system role', 'HIGH'] as const,
  ]) {
    let m: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(text)) !== null) {
      const inner = m[1] ?? '';
      // Scan the extracted text recursively for v1 patterns.
      const r = detectV1(inner);
      if (r.detected) {
        for (const p of r.patterns) {
          out.push({ stage: 'structural', pattern: `${label} → ${p}`, risk });
        }
      }
    }
  }
  return out;
}

// ---------- 3. Unicode normalization ----------

const ZERO_WIDTH = /[​-‍﻿⁠­]/g;
const RTL_OVERRIDE = /[‪-‮⁦-⁩]/g;

// Common Cyrillic / Greek confusables → Latin
const CONFUSABLES: Record<string, string> = {
  // Cyrillic
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', А: 'A', В: 'B', Е: 'E',
  К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X',
  // Greek
  ο: 'o', Ο: 'O', Α: 'A', Β: 'B', Ε: 'E', Η: 'H', Ι: 'I', Κ: 'K',
  Μ: 'M', Ν: 'N', Ρ: 'P', Τ: 'T', Υ: 'Y', Ζ: 'Z',
  // Other
  '․': '.', '‥': '..', '…': '...',
};

function canonicalize(text: string): string {
  let out = text.normalize('NFKC');
  out = out.replace(ZERO_WIDTH, '').replace(RTL_OVERRIDE, '');
  out = [...out].map((c) => CONFUSABLES[c] ?? c).join('');
  return out;
}

function runUnicode(text: string): { evidence: InjectionEvidence[]; canonical: string } {
  const canonical = canonicalize(text);
  if (canonical === text) {
    return { evidence: [], canonical };
  }
  const r = detectV1(canonical);
  const evidence: InjectionEvidence[] = [];
  if (r.detected) {
    for (const p of r.patterns) {
      evidence.push({ stage: 'unicode', pattern: `confusable/zero-width → ${p}`, risk: r.risk });
    }
  } else if (ZERO_WIDTH.test(text) || RTL_OVERRIDE.test(text)) {
    evidence.push({ stage: 'unicode', pattern: 'invisible-character payload detected', risk: 'LOW' });
  }
  return { evidence, canonical };
}

// ---------- 4. Encoding decode-and-rescan ----------

const BASE64_BLOB = /[A-Za-z0-9+/]{20,}={0,2}/g;
const HEX_BLOB = /(?:0x)?[0-9a-fA-F]{40,}/g;
const PERCENT_ENCODED = /(?:%[0-9A-Fa-f]{2}){8,}/g;

function runEncoding(text: string): InjectionEvidence[] {
  const out: InjectionEvidence[] = [];
  const tryDecode = (blob: string, kind: 'base64' | 'hex' | 'percent'): string | null => {
    try {
      if (kind === 'base64') {
        const cleaned = blob.replace(/\s/g, '');
        if (cleaned.length % 4 !== 0) return null;
        const buf = Buffer.from(cleaned, 'base64');
        const round = buf.toString('base64').replace(/=+$/, '');
        if (round !== cleaned.replace(/=+$/, '')) return null; // not real base64
        const s = buf.toString('utf-8');
        if (!/[\x20-\x7E]{8,}/.test(s)) return null; // not printable text
        return s;
      }
      if (kind === 'hex') {
        const cleaned = blob.replace(/^0x/, '');
        if (cleaned.length % 2 !== 0) return null;
        const s = Buffer.from(cleaned, 'hex').toString('utf-8');
        if (!/[\x20-\x7E]{8,}/.test(s)) return null;
        return s;
      }
      if (kind === 'percent') {
        return decodeURIComponent(blob);
      }
    } catch {
      return null;
    }
    return null;
  };

  for (const [pattern, kind] of [
    [BASE64_BLOB, 'base64'] as const,
    [HEX_BLOB, 'hex'] as const,
    [PERCENT_ENCODED, 'percent'] as const,
  ]) {
    let m: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(text)) !== null) {
      const decoded = tryDecode(m[0], kind);
      if (!decoded) continue;
      const r = detectV1(decoded);
      if (r.detected) {
        for (const p of r.patterns) {
          out.push({
            stage: 'encoding',
            pattern: `${kind}-decoded → ${p}`,
            risk: r.risk,
            decoded: decoded.slice(0, 80),
          });
        }
      }
    }
  }
  return out;
}

// ---------- 5. Spaced-letter de-spacing ----------

function runSpaced(text: string): InjectionEvidence[] {
  // Pattern: sequences of "X X X X" (single letters separated by single spaces)
  // get joined into "XXXX" before re-scanning. Catches "I g n o r e   p r e v i o u s".
  const dropSpaces = text.replace(/\b((?:[A-Za-z]\s){4,}[A-Za-z])\b/g, (m) => m.replace(/\s/g, ''));
  if (dropSpaces === text) return [];
  const r = detectV1(dropSpaces);
  if (!r.detected) return [];
  return r.patterns.map((p) => ({ stage: 'spaced' as const, pattern: `spaced-letters → ${p}`, risk: r.risk }));
}

// ---------- 6. Multilingual ----------

const MULTILINGUAL: Array<{ pattern: RegExp; description: string; risk: 'HIGH' | 'LOW' }> = [
  { pattern: /ignor[ae]\s+(?:las|todas)\s+(?:instrucciones|reglas)/i, description: 'ES: ignore instructions', risk: 'HIGH' },
  { pattern: /ignorez\s+(?:toutes\s+)?les\s+instructions/i, description: 'FR: ignore instructions', risk: 'HIGH' },
  { pattern: /ignorier(?:e|en)\s+(?:alle\s+)?(?:vorherigen\s+)?anweisungen/i, description: 'DE: ignore instructions', risk: 'HIGH' },
  { pattern: /पिछले\s+निर्देश(?:ों)?\s+को\s+(?:नज़र|नजर)अंदाज\s+कर/i, description: 'HI: ignore previous instructions', risk: 'HIGH' },
  { pattern: /忽略(?:之前|所有|前面|上面)(?:的)?(?:所有)?(?:的)?(?:指令|指示|提示)/u, description: 'ZH: ignore previous instructions', risk: 'HIGH' },
  { pattern: /игнорируй(?:те)?\s+(?:все\s+)?(?:предыдущие\s+)?инструкции/i, description: 'RU: ignore instructions', risk: 'HIGH' },
  { pattern: /(?:agora|ahora|maintenant|jetzt)\s+(?:você|tu|vous|du)\s+(?:é|es|est|bist)/i, description: 'identity override (multi-lang)', risk: 'HIGH' },
];

function runMultilingual(text: string): InjectionEvidence[] {
  const out: InjectionEvidence[] = [];
  for (const { pattern, description, risk } of MULTILINGUAL) {
    if (pattern.test(text)) {
      out.push({ stage: 'multilingual', pattern: description, risk });
    }
  }
  return out;
}

// ---------- Orchestrator ----------

export function detectInjectionV2(text: string): InjectionResultV2 {
  if (!text) return { detected: false, risk: 'LOW', confidence: 0, evidence: [], canonical: '' };
  const MAX_LEN = 50_000;
  const scan = text.length > MAX_LEN ? text.slice(0, MAX_LEN) : text;

  const standard = runStandard(scan);
  const structural = runStructural(scan);
  const { evidence: unicode, canonical } = runUnicode(scan);
  const encoding = runEncoding(scan);
  const spaced = runSpaced(scan);
  const multilingual = runMultilingual(scan);
  const extended = scanExtended(scan);

  const evidence = [...standard, ...structural, ...unicode, ...encoding, ...spaced, ...multilingual, ...extended];
  const detected = evidence.length > 0;
  const highRisk = evidence.some((e) => e.risk === 'HIGH');
  // Confidence scales with # of stages firing AND severity.
  const stagesFired = new Set(evidence.map((e) => e.stage)).size;
  const confidence = detected ? Math.min(1, 0.4 + 0.15 * stagesFired + (highRisk ? 0.25 : 0)) : 0;

  return {
    detected,
    risk: highRisk ? 'HIGH' : 'LOW',
    confidence,
    evidence,
    canonical,
  };
}

/** Compatibility shim — same shape as v1 result for callers that haven't migrated. */
export function detectInjectionCompat(text: string): InjectionDetectionResult {
  const r = detectInjectionV2(text);
  return {
    detected: r.detected,
    patterns: r.evidence.map((e) => e.pattern),
    risk: r.risk,
    confidence: r.confidence,
  };
}
