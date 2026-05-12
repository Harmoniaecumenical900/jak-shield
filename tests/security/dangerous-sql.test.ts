import { describe, expect, test } from 'vitest';
import { DecisionAction } from '@jak-shield/shared';
import { decide } from '@jak-shield/policy-engine';
import { req } from './helpers.js';

describe('dangerous-sql', () => {
  test('DROP TABLE users → block', () => {
    const d = decide(req('supabase.query', { sql: 'DROP TABLE users;' }));
    expect(d.action).toBe(DecisionAction.BLOCK);
    expect(d.rule).toBe('dangerous-sql');
  });

  test('DELETE without WHERE → requires approval', () => {
    const d = decide(req('postgres.query', { sql: 'DELETE FROM accounts' }));
    expect(d.action).toBe(DecisionAction.REQUIRES_APPROVAL);
    expect(d.rule).toBe('dangerous-sql');
  });

  test('SELECT is allowed', () => {
    const d = decide(req('postgres.query', { sql: 'SELECT id FROM users LIMIT 1' }));
    expect(d.action).not.toBe(DecisionAction.BLOCK);
  });

  test('TRUNCATE is blocked', () => {
    const d = decide(req('supabase.query', { sql: 'TRUNCATE TABLE logs' }));
    expect(d.action).toBe(DecisionAction.BLOCK);
  });
});
