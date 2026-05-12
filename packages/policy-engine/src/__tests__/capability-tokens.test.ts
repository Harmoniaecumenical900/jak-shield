import { beforeEach, describe, expect, test } from 'vitest';
import { hashArgs, issueCapability, verifyCapability } from '../capability-tokens.js';

describe('capability tokens', () => {
  beforeEach(() => {
    process.env.JAK_SHIELD_CAP_TOKEN_SECRET = 'test-cap-secret';
  });

  test('round-trip: issue + verify with matching tenant/tool/args', () => {
    const token = issueCapability({ tenantId: 't1', toolName: 'gmail.send_email', args: { to: 'x@y.com' } });
    const v = verifyCapability(token, { tenantId: 't1', toolName: 'gmail.send_email', args: { to: 'x@y.com' } });
    expect(v.ok).toBe(true);
  });

  test('single-use: second verify burns', () => {
    const token = issueCapability({ tenantId: 't1', toolName: 'gmail.send_email', args: { to: 'x' } });
    const first = verifyCapability(token, { tenantId: 't1', toolName: 'gmail.send_email', args: { to: 'x' } });
    expect(first.ok).toBe(true);
    const second = verifyCapability(token, { tenantId: 't1', toolName: 'gmail.send_email', args: { to: 'x' } });
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('already used');
  });

  test('wrong tenant rejected', () => {
    const token = issueCapability({ tenantId: 't1', toolName: 'gmail.send_email', args: { to: 'x' } });
    const v = verifyCapability(token, { tenantId: 't2', toolName: 'gmail.send_email', args: { to: 'x' } });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('tenant mismatch');
  });

  test('wrong tool rejected', () => {
    const token = issueCapability({ tenantId: 't1', toolName: 'gmail.send_email', args: { to: 'x' } });
    const v = verifyCapability(token, { tenantId: 't1', toolName: 'shell.run', args: { to: 'x' } });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('tool mismatch');
  });

  test('different args rejected', () => {
    const token = issueCapability({ tenantId: 't1', toolName: 'gmail.send_email', args: { to: 'a@y.com' } });
    const v = verifyCapability(token, { tenantId: 't1', toolName: 'gmail.send_email', args: { to: 'b@y.com' } });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('args mismatch');
  });

  test('expired token rejected', async () => {
    const token = issueCapability({ tenantId: 't1', toolName: 'x', args: {}, ttlSeconds: 1 });
    await new Promise((r) => setTimeout(r, 2100));
    const v = verifyCapability(token, { tenantId: 't1', toolName: 'x', args: {} });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('expired');
  });

  test('tampered token rejected', () => {
    const token = issueCapability({ tenantId: 't1', toolName: 'x', args: {} });
    const tampered = token.slice(0, -3) + 'AAA';
    const v = verifyCapability(tampered, { tenantId: 't1', toolName: 'x', args: {} });
    expect(v.ok).toBe(false);
  });

  test('hashArgs is stable across key order', () => {
    const a = hashArgs({ a: 1, b: 2 });
    const b = hashArgs({ b: 2, a: 1 });
    expect(a).toBe(b);
  });
});
