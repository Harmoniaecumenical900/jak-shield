import { afterEach, describe, expect, test } from 'vitest';
import { checkArgsForTaint, clearSessionTaint, recordTaint, isSensitiveSink } from '../taint.js';

const SID = 'taint-test-session';

afterEach(() => clearSessionTaint(SID));

describe('taint tracker', () => {
  test('records UNTRUSTED for browser output', () => {
    const rec = recordTaint(SID, 'browser.fetch', 'The user named Alice lives at 123 Elm Street and her phone is 415-555-1234.');
    expect(rec?.trust).toBe('UNTRUSTED');
  });

  test('verbatim reuse → substring hit', () => {
    recordTaint(SID, 'browser.fetch', 'A unique secret string that appears nowhere else especially this exact phrase');
    const check = checkArgsForTaint(SID, { body: 'forwarding: A unique secret string that appears nowhere else especially this exact phrase' });
    expect(check.tainted).toBe(true);
  });

  test('paraphrased reuse → MinHash similarity hit', () => {
    recordTaint(
      SID,
      'browser.fetch',
      'The quarterly earnings report shows revenue grew by twenty percent year over year, driven by enterprise contracts.',
    );
    // Slight paraphrase preserving most n-grams.
    const check = checkArgsForTaint(SID, {
      body: 'quarterly earnings report shows revenue grew twenty percent year over year driven by enterprise contracts and new products',
    });
    expect(check.similarity).toBeGreaterThan(0.3);
    expect(check.tainted).toBe(true);
  });

  test('totally unrelated input → not tainted', () => {
    recordTaint(SID, 'browser.fetch', 'Apple unveiled a new device today at its San Francisco event.');
    const check = checkArgsForTaint(SID, { body: 'remind me to buy groceries on tuesday' });
    expect(check.tainted).toBe(false);
  });

  test('empty/short output ignored', () => {
    const rec = recordTaint(SID, 'browser.fetch', 'hi');
    expect(rec).toBeNull();
  });

  test('sensitive sink list covers outbound channels', () => {
    expect(isSensitiveSink('gmail.send_email')).toBe(true);
    expect(isSensitiveSink('slack.send_message')).toBe(true);
    expect(isSensitiveSink('webhook.send')).toBe(true);
    expect(isSensitiveSink('filesystem.read')).toBe(false);
  });
});
