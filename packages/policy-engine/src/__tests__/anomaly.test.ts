import { beforeEach, describe, expect, test } from 'vitest';
import { evaluateAnomaly, recordCall, resetAnomalyState, anomalySnapshot } from '../anomaly.js';

beforeEach(() => resetAnomalyState());

describe('anomaly detector', () => {
  test('first call is not anomalous for READ_ONLY tools', () => {
    const r = evaluateAnomaly('t1', 'filesystem.read', 'READ_ONLY');
    expect(r.detected).toBe(false);
    recordCall('t1', 'filesystem.read');
  });

  test('first call IS flagged for DESTRUCTIVE tools (first-seen)', () => {
    recordCall('t1', 'filesystem.delete');
    const r = evaluateAnomaly('t1', 'filesystem.delete', 'DESTRUCTIVE');
    expect(r.detected).toBe(true);
    expect(r.signalKind).toBe('first-seen');
  });

  test('burst: 6+ destructive calls in 60s flagged', () => {
    for (let i = 0; i < 6; i++) recordCall('t1', 'filesystem.delete');
    const r = evaluateAnomaly('t1', 'filesystem.delete', 'DESTRUCTIVE');
    expect(r.detected).toBe(true);
    expect(r.signalKind).toBe('burst');
  });

  test('burst: 20+ read calls in 60s flagged', () => {
    for (let i = 0; i < 21; i++) recordCall('t1', 'filesystem.read');
    const r = evaluateAnomaly('t1', 'filesystem.read', 'READ_ONLY');
    expect(r.detected).toBe(true);
    expect(r.signalKind).toBe('burst');
  });

  test('per-agent baselines are isolated', () => {
    for (let i = 0; i < 6; i++) recordCall('t1', 'shell.run', 'agentA');
    const agentA = evaluateAnomaly('t1', 'shell.run', 'EXTERNAL_SIDE_EFFECT', 'agentA');
    recordCall('t1', 'shell.run', 'agentB');
    const agentB = evaluateAnomaly('t1', 'shell.run', 'EXTERNAL_SIDE_EFFECT', 'agentB');
    expect(agentA.detected).toBe(true);
    expect(agentB.signalKind).toBe('first-seen');
  });

  test('snapshot reports counters', () => {
    recordCall('t1', 'gmail.send_email');
    recordCall('t1', 'gmail.send_email');
    const snap = anomalySnapshot('t1');
    expect(snap['gmail.send_email']?.totalCalls).toBe(2);
    expect(snap['gmail.send_email']?.last1m).toBe(2);
  });
});
