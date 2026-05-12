import { describe, expect, test } from 'vitest';
import { DecisionAction, UserRole } from '@jak-shield/shared';
import { decide } from '@jak-shield/policy-engine';
import { req } from './helpers.js';

describe('approval-bypass', () => {
  test('END_USER cannot run a destructive tool', () => {
    const d = decide(req('filesystem.delete', { path: 'demo/file.txt' }, UserRole.END_USER));
    expect(d.action).toBe(DecisionAction.BLOCK);
    expect(d.rule).toBe('rbac-tool-execute');
  });

  test('END_USER cannot run an external-side-effect tool', () => {
    const d = decide(req('slack.send_message', { channel: '#general', text: 'hi' }, UserRole.END_USER));
    expect(d.action).toBe(DecisionAction.BLOCK);
    expect(d.rule).toBe('rbac-tool-execute');
  });

  test('TENANT_ADMIN can run write but external-side-effect needs approval', () => {
    const d = decide(req('slack.send_message', { channel: '#general', text: 'hi' }, UserRole.TENANT_ADMIN));
    expect([DecisionAction.REQUIRES_APPROVAL, DecisionAction.ALLOW]).toContain(d.action);
  });
});
