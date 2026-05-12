import { scanAndRedact } from './redactor.js';

/**
 * Strip PII + secrets from any JSON value before persistence.
 * Walks nested objects and arrays. One-way: original values cannot be recovered
 * from the result. Suitable for audit-log `details` columns and trace dumps.
 */
export function redactJsonForPersistence(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return scanAndRedact(value).redacted;
  }
  if (Array.isArray(value)) {
    return value.map(redactJsonForPersistence);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactJsonForPersistence(v);
    }
    return out;
  }
  return value;
}
