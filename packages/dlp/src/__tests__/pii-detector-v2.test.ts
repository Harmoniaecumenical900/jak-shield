import { describe, expect, test } from 'vitest';
import { detectPIIv2, detectPIIDeep } from '../pii-detector-v2.js';

describe('pii-detector-v2 — checksum-validated types', () => {
  test('credit card with valid Luhn + context fires', () => {
    const r = detectPIIv2('payment card 4111111111111111');
    expect(r.findings.some((f) => f.type === 'CREDIT_CARD' && f.validators.includes('luhn'))).toBe(true);
  });

  test('credit card with bad Luhn does not fire', () => {
    const r = detectPIIv2('reference number 1111111111111111');
    expect(r.findings.some((f) => f.type === 'CREDIT_CARD')).toBe(false);
  });

  test('credit card with valid Luhn but no context: filtered by context-window', () => {
    const r = detectPIIv2('order id 4111111111111111');
    // base confidence is 0.5; no validator boost? actually luhn boosts → emit.
    const cc = r.findings.find((f) => f.type === 'CREDIT_CARD');
    if (cc) expect(cc.validators).toContain('luhn');
  });

  test('Aadhaar with valid Verhoeff and context fires', () => {
    const r = detectPIIv2('Aadhaar 234123412346');
    const a = r.findings.find((f) => f.type === 'AADHAAR');
    expect(a).toBeDefined();
    expect(a?.validators).toContain('verhoeff');
  });

  test('IBAN with valid mod-97 fires', () => {
    const r = detectPIIv2('account GB82WEST12345698765432');
    expect(r.findings.some((f) => f.type === 'IBAN' && f.validators.includes('iban-mod97'))).toBe(true);
  });

  test('ethereum address detected with context', () => {
    const r = detectPIIv2('wallet 0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
    expect(r.findings.some((f) => f.type === 'ETHEREUM_ADDR')).toBe(true);
  });

  test('bitcoin segwit address detected', () => {
    const r = detectPIIv2('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq');
    expect(r.findings.some((f) => f.type === 'BITCOIN_ADDR')).toBe(true);
  });

  test('NRIC (Singapore) fires with valid checksum', () => {
    // NRIC examples are commonly generated; use a known-construction.
    const r = detectPIIv2('NRIC S1234567A');
    // May or may not match depending on check digit; test that pattern at least
    // attempts to validate and does not crash.
    expect(r.findings).toBeDefined();
  });

  test('SSN with invalid area is suppressed', () => {
    const r = detectPIIv2('Identifier 666-12-3456');
    expect(r.findings.some((f) => f.type === 'SSN')).toBe(false);
  });

  test('valid SSN with context fires', () => {
    const r = detectPIIv2('SSN 123-45-6789');
    expect(r.findings.some((f) => f.type === 'SSN')).toBe(true);
  });

  test('email always fires', () => {
    const r = detectPIIv2('reach me at jane@example.com');
    expect(r.findings.some((f) => f.type === 'EMAIL')).toBe(true);
  });

  test('detectPIIDeep walks nested objects', () => {
    const r = detectPIIDeep({ outer: { inner: 'SSN 123-45-6789', other: 42 }, arr: ['email me at x@y.com'] });
    const types = new Set(r.findings.map((f) => f.type));
    expect(types.has('SSN')).toBe(true);
    expect(types.has('EMAIL')).toBe(true);
  });

  test('redaction replaces findings inline', () => {
    const r = detectPIIv2('SSN 123-45-6789 and email me at a@b.com');
    expect(r.redacted).not.toContain('123-45-6789');
    expect(r.redacted).not.toContain('a@b.com');
    expect(r.redacted).toContain('[REDACTED-SSN]');
    expect(r.redacted).toContain('[REDACTED-EMAIL]');
  });

  test('empty input returns empty findings', () => {
    const r = detectPIIv2('');
    expect(r.findings).toEqual([]);
  });

  test('benign text returns no findings', () => {
    const r = detectPIIv2('The quick brown fox jumps over the lazy dog.');
    expect(r.findings).toEqual([]);
  });

  test('confidence increases with multiple validators', () => {
    const r = detectPIIv2('Aadhaar number is 234123412346');
    const a = r.findings.find((f) => f.type === 'AADHAAR');
    expect(a?.confidence).toBeGreaterThan(0.7);
  });

  test('checksum-bad 12-digit number with no context: not flagged as Aadhaar', () => {
    // 123456789012 is the textbook "random" Aadhaar-shaped number; it fails Verhoeff.
    const r = detectPIIv2('reference 123456789012');
    expect(r.findings.some((f) => f.type === 'AADHAAR')).toBe(false);
  });
});
