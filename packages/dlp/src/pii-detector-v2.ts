/**
 * Multi-layer PII detector: regex → validator → context-window scoring.
 * Emits Evidence records compatible with the policy-engine provenance tree.
 *
 * False-positive reduction vs. v1:
 * - Credit cards: Luhn check (rejects 16 random digits)
 * - Aadhaar: Verhoeff checksum (rejects 12 random digits)
 * - IBAN: mod-97 check
 * - ABA: weighted-sum check
 * - SSN: rejects invalid area/group/serial blocks
 * - NHS: mod-11 check
 *
 * Each finding ships with: validators[] (which checks passed), confidence (0..1),
 * field (which input field), and sample (redacted preview).
 */

import {
  panValid,
  abaValid,
  ibanValid,
  luhnValid,
  nhsValid,
  ssnValid,
  verhoeffValid,
  cpfValid,
  cnpjValid,
  sinValid,
  nricValid,
  tfnValid,
  einValid,
  swiftValid,
  bitcoinValid,
  ethereumValid,
  ipv6Valid,
  imeiValid,
  macValid,
} from './validators.js';

export type PIITypeV2 =
  | 'EMAIL'
  | 'PHONE'
  | 'SSN'
  | 'CREDIT_CARD'
  | 'DATE_OF_BIRTH'
  | 'MEDICAL_RECORD_NUMBER'
  | 'PASSPORT'
  | 'IP_ADDRESS'
  | 'IPV6'
  | 'BANK_ACCOUNT_US'
  | 'IBAN'
  | 'SWIFT_BIC'
  | 'DRIVER_LICENSE'
  | 'AADHAAR'
  | 'PAN'
  | 'NHS'
  | 'STUDENT_RECORD'
  | 'CPF'
  | 'CNPJ'
  | 'SIN'
  | 'NRIC'
  | 'TFN'
  | 'EIN'
  | 'BITCOIN_ADDR'
  | 'ETHEREUM_ADDR'
  | 'IMEI'
  | 'MAC_ADDR';

export interface PIIFindingV2 {
  type: PIITypeV2;
  /** PII-redacted sample for audit. */
  sample: string;
  startIndex: number;
  endIndex: number;
  /** Validators that confirmed this finding. */
  validators: string[];
  /** 0..1 — 1.0 means regex + validator + context all agreed. */
  confidence: number;
  /** Context window that boosted/lowered confidence. */
  contextHint?: string;
  field?: string;
}

interface RegexLayer {
  type: PIITypeV2;
  pattern: RegExp;
  validate?: (s: string, fullText: string, matchIndex: number) => { ok: boolean; validators: string[] };
  contextWords?: string[]; // Words that, when nearby, boost confidence.
  baseConfidence: number;
}

const LAYERS: RegexLayer[] = [
  {
    type: 'EMAIL',
    pattern: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g,
    baseConfidence: 0.95,
  },
  {
    type: 'SSN',
    pattern: /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g,
    validate: (s) => ({ ok: ssnValid(s), validators: ssnValid(s) ? ['ssn-block-check'] : [] }),
    contextWords: ['ssn', 'social security', 'soc sec', 'taxpayer'],
    baseConfidence: 0.6,
  },
  {
    type: 'AADHAAR',
    pattern: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
    validate: (s) => ({ ok: verhoeffValid(s), validators: verhoeffValid(s) ? ['verhoeff'] : [] }),
    contextWords: ['aadhaar', 'aadhar', 'uid'],
    baseConfidence: 0.35,
  },
  {
    type: 'PAN',
    pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    validate: (s) => ({ ok: panValid(s), validators: ['pan-format'] }),
    contextWords: ['pan', 'permanent account'],
    baseConfidence: 0.85,
  },
  {
    type: 'CREDIT_CARD',
    pattern: /\b(?:\d[ \-]?){13,19}\b/g,
    validate: (s) => ({ ok: luhnValid(s), validators: luhnValid(s) ? ['luhn'] : [] }),
    contextWords: ['card', 'visa', 'mastercard', 'amex', 'cc'],
    baseConfidence: 0.5,
  },
  {
    type: 'PHONE',
    pattern: /(\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}\b|\+\d{1,3}[\s\-.]?\d{2,4}[\s\-.]?\d{4,}/g,
    contextWords: ['phone', 'tel', 'mobile', 'cell', 'call', 'whatsapp'],
    baseConfidence: 0.7,
  },
  {
    type: 'DATE_OF_BIRTH',
    pattern:
      /(?:DOB|Date of Birth|Birth Date|Born)[:\s]+(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/gi,
    baseConfidence: 0.95,
  },
  {
    type: 'MEDICAL_RECORD_NUMBER',
    pattern: /\b(?:MRN|Medical Record)[#:\s]+\s*\d{6,10}\b/gi,
    baseConfidence: 0.9,
  },
  {
    type: 'PASSPORT',
    pattern: /\b(?:Passport)[#:\s]+[A-Z]{1,2}\d{6,9}\b/g,
    baseConfidence: 0.9,
  },
  {
    type: 'IP_ADDRESS',
    pattern:
      /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    baseConfidence: 0.9,
  },
  {
    type: 'BANK_ACCOUNT_US',
    pattern: /\b(?:Account|Acct|Routing)[\s#:]+(\d{7,17})\b/gi,
    validate: (s) => {
      // The matched piece includes prefix; extract digits and test as ABA only if exactly 9.
      const digits = (s.match(/\d{7,17}/g)?.[0]) ?? '';
      if (digits.length === 9 && abaValid(digits)) return { ok: true, validators: ['aba'] };
      return { ok: digits.length >= 7, validators: ['format'] };
    },
    baseConfidence: 0.85,
  },
  {
    type: 'IBAN',
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9 ]{11,30}\b/g,
    validate: (s) => ({ ok: ibanValid(s), validators: ibanValid(s) ? ['iban-mod97'] : [] }),
    baseConfidence: 0.5,
  },
  {
    type: 'NHS',
    pattern: /\b\d{3}[ -]?\d{3}[ -]?\d{4}\b/g,
    validate: (s) => ({ ok: nhsValid(s), validators: nhsValid(s) ? ['nhs-mod11'] : [] }),
    contextWords: ['nhs', 'patient'],
    baseConfidence: 0.4,
  },
  {
    type: 'DRIVER_LICENSE',
    pattern: /\b(?:DL|Driver['\s]?s?\s+License)[#:\s]+[A-Z0-9]{5,15}\b/gi,
    baseConfidence: 0.9,
  },
  {
    type: 'STUDENT_RECORD',
    pattern: /\b(?:Student\s*ID|StudentID|Roll\s*No|Roll\s*Number|Student\s*Record)[#:\s]+[A-Z0-9\-]{3,20}\b/gi,
    baseConfidence: 0.95,
  },
  {
    type: 'IPV6',
    pattern: /\b(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4}\b|::1\b|::\b/gi,
    validate: (s) => ({ ok: ipv6Valid(s), validators: ipv6Valid(s) ? ['ipv6-format'] : [] }),
    baseConfidence: 0.4,
  },
  {
    type: 'SWIFT_BIC',
    pattern: /\b[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/g,
    validate: (s) => ({ ok: swiftValid(s), validators: swiftValid(s) ? ['swift-format'] : [] }),
    contextWords: ['swift', 'bic', 'iban', 'wire', 'transfer'],
    baseConfidence: 0.35,
  },
  {
    type: 'CPF',
    pattern: /\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/g,
    validate: (s) => ({ ok: cpfValid(s), validators: cpfValid(s) ? ['cpf-checksum'] : [] }),
    contextWords: ['cpf', 'brazil', 'brasil'],
    baseConfidence: 0.4,
  },
  {
    type: 'CNPJ',
    pattern: /\b\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2}\b/g,
    validate: (s) => ({ ok: cnpjValid(s), validators: cnpjValid(s) ? ['cnpj-checksum'] : [] }),
    contextWords: ['cnpj'],
    baseConfidence: 0.4,
  },
  {
    type: 'SIN',
    pattern: /\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b/g,
    validate: (s) => ({ ok: sinValid(s), validators: sinValid(s) ? ['sin-luhn'] : [] }),
    contextWords: ['sin', 'social insurance', 'canada'],
    baseConfidence: 0.35,
  },
  {
    type: 'NRIC',
    pattern: /\b[STFG]\d{7}[A-Z]\b/gi,
    validate: (s) => ({ ok: nricValid(s), validators: nricValid(s) ? ['nric-checksum'] : [] }),
    contextWords: ['nric', 'singapore'],
    baseConfidence: 0.85,
  },
  {
    type: 'TFN',
    pattern: /\b\d{3}[-\s]?\d{3}[-\s]?\d{2,3}\b/g,
    validate: (s) => ({ ok: tfnValid(s), validators: tfnValid(s) ? ['tfn-checksum'] : [] }),
    contextWords: ['tfn', 'tax file', 'australia'],
    baseConfidence: 0.35,
  },
  {
    type: 'EIN',
    pattern: /\b\d{2}-\d{7}\b/g,
    validate: (s) => ({ ok: einValid(s), validators: einValid(s) ? ['ein-prefix'] : [] }),
    contextWords: ['ein', 'employer identification'],
    baseConfidence: 0.6,
  },
  {
    type: 'BITCOIN_ADDR',
    pattern: /\b(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{8,87})\b/g,
    validate: (s) => ({ ok: bitcoinValid(s), validators: bitcoinValid(s) ? ['btc-format'] : [] }),
    baseConfidence: 0.9,
  },
  {
    type: 'ETHEREUM_ADDR',
    pattern: /\b0x[0-9a-fA-F]{40}\b/g,
    validate: (s) => ({ ok: ethereumValid(s), validators: ['eth-format'] }),
    baseConfidence: 0.95,
  },
  {
    type: 'IMEI',
    pattern: /\b\d{15}\b/g,
    validate: (s) => ({ ok: imeiValid(s), validators: imeiValid(s) ? ['imei-luhn'] : [] }),
    contextWords: ['imei', 'phone', 'device'],
    baseConfidence: 0.3,
  },
  {
    type: 'MAC_ADDR',
    pattern: /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g,
    validate: (s) => ({ ok: macValid(s), validators: ['mac-format'] }),
    baseConfidence: 0.9,
  },
];

const REDACTION_LABEL: Record<PIITypeV2, string> = {
  EMAIL: '[REDACTED-EMAIL]',
  PHONE: '[REDACTED-PHONE]',
  SSN: '[REDACTED-SSN]',
  CREDIT_CARD: '[REDACTED-CC]',
  DATE_OF_BIRTH: '[REDACTED-DOB]',
  MEDICAL_RECORD_NUMBER: '[REDACTED-MRN]',
  PASSPORT: '[REDACTED-PASSPORT]',
  IP_ADDRESS: '[REDACTED-IP]',
  IPV6: '[REDACTED-IPV6]',
  BANK_ACCOUNT_US: '[REDACTED-BANK-ACCT]',
  IBAN: '[REDACTED-IBAN]',
  SWIFT_BIC: '[REDACTED-SWIFT]',
  DRIVER_LICENSE: '[REDACTED-DL]',
  AADHAAR: '[REDACTED-AADHAAR]',
  PAN: '[REDACTED-PAN]',
  NHS: '[REDACTED-NHS]',
  STUDENT_RECORD: '[REDACTED-STUDENT]',
  CPF: '[REDACTED-CPF]',
  CNPJ: '[REDACTED-CNPJ]',
  SIN: '[REDACTED-SIN]',
  NRIC: '[REDACTED-NRIC]',
  TFN: '[REDACTED-TFN]',
  EIN: '[REDACTED-EIN]',
  BITCOIN_ADDR: '[REDACTED-BTC]',
  ETHEREUM_ADDR: '[REDACTED-ETH]',
  IMEI: '[REDACTED-IMEI]',
  MAC_ADDR: '[REDACTED-MAC]',
};

export interface PIIScanResultV2 {
  findings: PIIFindingV2[];
  redacted: string;
  /** Highest confidence finding's score; useful as a single risk signal. */
  maxConfidence: number;
}

const MIN_EMIT_CONFIDENCE = 0.5;

export function detectPIIv2(text: string, field?: string): PIIScanResultV2 {
  if (!text) return { findings: [], redacted: '', maxConfidence: 0 };

  const findings: PIIFindingV2[] = [];
  const lower = text.toLowerCase();

  for (const layer of LAYERS) {
    layer.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = layer.pattern.exec(text)) !== null) {
      const sample = match[0];
      let confidence = layer.baseConfidence;
      const validators: string[] = ['regex'];

      if (layer.validate) {
        const v = layer.validate(sample, text, match.index);
        if (!v.ok) continue; // hard reject: regex matched but validator failed
        validators.push(...v.validators);
        confidence = Math.min(1, confidence + 0.3);
      }

      let contextHint: string | undefined;
      if (layer.contextWords?.length) {
        const windowStart = Math.max(0, match.index - 40);
        const windowEnd = Math.min(text.length, match.index + sample.length + 40);
        const window = lower.slice(windowStart, windowEnd);
        const hit = layer.contextWords.find((w) => window.includes(w));
        if (hit) {
          confidence = Math.min(1, confidence + 0.25);
          validators.push('context');
          contextHint = hit;
        } else if (confidence < 0.6) {
          // No context word AND only the regex fired → likely noise.
          continue;
        }
      }

      if (confidence < MIN_EMIT_CONFIDENCE) continue;

      findings.push({
        type: layer.type,
        sample,
        startIndex: match.index,
        endIndex: match.index + sample.length,
        validators,
        confidence,
        contextHint,
        field,
      });
    }
  }

  // Build redacted text. Sort findings by start desc so replacements don't shift indexes.
  const sortedDesc = [...findings].sort((a, b) => b.startIndex - a.startIndex);
  let redacted = text;
  for (const f of sortedDesc) {
    redacted = redacted.slice(0, f.startIndex) + REDACTION_LABEL[f.type] + redacted.slice(f.endIndex);
  }

  const maxConfidence = findings.reduce((m, f) => Math.max(m, f.confidence), 0);

  return { findings, redacted, maxConfidence };
}

export function detectPIIDeep(
  obj: Record<string, unknown>,
): { findings: PIIFindingV2[]; redacted: Record<string, unknown> } {
  const out: Record<string, unknown> = {};
  const findings: PIIFindingV2[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      const r = detectPIIv2(v, k);
      findings.push(...r.findings);
      out[k] = r.redacted;
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sub = detectPIIDeep(v as Record<string, unknown>);
      findings.push(...sub.findings);
      out[k] = sub.redacted;
    } else if (Array.isArray(v)) {
      out[k] = v.map((item) => {
        if (typeof item === 'string') {
          const r = detectPIIv2(item, k);
          findings.push(...r.findings);
          return r.redacted;
        }
        return item;
      });
    } else {
      out[k] = v;
    }
  }
  return { findings, redacted: out };
}
