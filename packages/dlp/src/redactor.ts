import { detectPII, type PIIDetectionResult } from './pii-detector.js';
import { detectSecrets, type SecretDetectionResult } from './secrets-detector.js';

export interface CombinedScanResult {
  pii: PIIDetectionResult;
  secrets: SecretDetectionResult;
  redacted: string;
  hasFindings: boolean;
}

export function scanAndRedact(text: string): CombinedScanResult {
  const pii = detectPII(text);
  const secrets = detectSecrets(pii.redacted);
  return {
    pii,
    secrets,
    redacted: secrets.redacted,
    hasFindings: pii.containsPII || secrets.containsSecrets,
  };
}

const SCAN_FIELDS = ['body', 'message', 'text', 'content', 'subject', 'note', 'description', 'sql', 'query', 'command', 'args', 'data'];

export function scanAndRedactObject<T extends Record<string, unknown>>(
  obj: T,
): { redacted: T; findings: { field: string; pii: string[]; secrets: string[] }[] } {
  const findings: { field: string; pii: string[]; secrets: string[] }[] = [];
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      const scan = scanAndRedact(value);
      if (scan.hasFindings) {
        findings.push({
          field: key,
          pii: scan.pii.found,
          secrets: scan.secrets.found,
        });
        out[key] = scan.redacted;
      } else {
        out[key] = value;
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      const sub = scanAndRedactObject(value as Record<string, unknown>);
      if (sub.findings.length > 0) {
        for (const f of sub.findings) findings.push({ ...f, field: `${key}.${f.field}` });
      }
      out[key] = sub.redacted;
    } else if (Array.isArray(value)) {
      out[key] = value.map((v) => {
        if (typeof v === 'string') {
          const scan = scanAndRedact(v);
          if (scan.hasFindings) {
            findings.push({
              field: `${key}[]`,
              pii: scan.pii.found,
              secrets: scan.secrets.found,
            });
            return scan.redacted;
          }
          return v;
        }
        return v;
      });
    } else {
      out[key] = value;
    }
  }

  return { redacted: out as T, findings };
}

export function shouldDeepScanField(name: string): boolean {
  return SCAN_FIELDS.includes(name.toLowerCase());
}
