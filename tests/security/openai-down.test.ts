import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { decide } from '@jak-shield/policy-engine';
import { DecisionAction } from '@jak-shield/shared';
import { req } from './helpers.js';

describe('openai-down (graceful degrade)', () => {
  let saved: string | undefined;

  beforeAll(() => {
    saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });
  afterAll(() => {
    if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
  });

  test('all deterministic decisions still work without OPENAI_API_KEY', () => {
    expect(decide(req('shell.run', { command: 'rm -rf /' })).action).toBe(DecisionAction.BLOCK);
    expect(decide(req('supabase.query', { sql: 'DROP TABLE users' })).action).toBe(DecisionAction.BLOCK);
    expect(decide(req('gmail.send_email', { to: 'x@external.com', subject: 't', body: 'SSN 123-45-6789' })).action).toBe(
      DecisionAction.REQUIRES_APPROVAL,
    );
    expect(decide(req('filesystem.read', { path: 'demo/x.txt' })).action).not.toBe(DecisionAction.BLOCK);
  });
});
