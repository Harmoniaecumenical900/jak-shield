import { afterEach, describe, expect, test } from 'vitest';
import { clearSessionHistory, detectAttackChain, recordSessionCall } from '../attack-chains.js';

const SID = 'chain-test';
afterEach(() => clearSessionHistory(SID));

describe('attack-chain detector', () => {
  test('lone call is never a chain', () => {
    recordSessionCall(SID, 'filesystem.read');
    const r = detectAttackChain(SID, 'filesystem.read', {});
    expect(r.matched).toBeNull();
  });

  test('read-then-exfiltrate is matched', () => {
    recordSessionCall(SID, 'filesystem.read');
    const r = detectAttackChain(SID, 'gmail.send_email', { to: 'x@external.com', body: 'data' });
    expect(r.matched?.id).toBe('read-pii-then-exfiltrate');
  });

  test('credential-harvest only fires with credential-y args', () => {
    recordSessionCall(SID, 'filesystem.read');
    const benign = detectAttackChain(SID, 'webhook.send', { url: 'x', payload: { weather: 'sunny' } });
    expect(benign.matched?.id).not.toBe('credential-harvest');
    clearSessionHistory(SID);
    recordSessionCall(SID, 'filesystem.read');
    const malicious = detectAttackChain(SID, 'webhook.send', { url: 'x', payload: 'leaked .env contents' });
    expect(malicious.matched?.id).toBe('credential-harvest');
  });

  test('data-flow boost when output substring appears in next args', () => {
    const output = 'leaked secret OAuth token AKIAIOSFODNN7EXAMPLE that should not leave the org';
    recordSessionCall(SID, 'filesystem.read', output);
    const r = detectAttackChain(SID, 'gmail.send_email', {
      to: 'x@external.com',
      body: `Look at this: ${output}`,
    });
    expect(r.matched).not.toBeNull();
    expect(r.dataFlow).toBe(true);
  });

  test('confidence scaling: data-flow > no-data-flow', () => {
    const output = 'a' .repeat(80);
    recordSessionCall(SID, 'filesystem.read', output);
    const withFlow = detectAttackChain(SID, 'gmail.send_email', { body: output });
    clearSessionHistory(SID);
    recordSessionCall(SID, 'filesystem.read', output);
    const withoutFlow = detectAttackChain(SID, 'gmail.send_email', { body: 'unrelated message' });
    expect(withFlow.confidence).toBeGreaterThanOrEqual(withoutFlow.confidence);
  });
});
