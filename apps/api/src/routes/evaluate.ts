import type { FastifyPluginAsync } from 'fastify';
import { evaluateAndMaybeExecute, makeContext } from '@jak-shield/mcp-server';
import { decisionToJson } from '@jak-shield/core';
import { detectInjectionV2, sanitizeToolOutput } from '@jak-shield/prompt-shield';
import { detectPIIv2, detectPIIDeep, detectSecrets, redactPII } from '@jak-shield/dlp';
import { evaluateRegulatoryHints } from '@jak-shield/policy-engine';

export const evaluateRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /api/evaluate — full policy decision for a planned tool call.
   * Body: { tool_name, args?, context?, execute? }
   */
  app.post('/', async (req) => {
    const body = req.body as {
      tool_name: string;
      args?: Record<string, unknown>;
      context?: Partial<Parameters<typeof makeContext>[0]>;
      execute?: boolean;
    };
    const ctx = makeContext(body.context ?? {});
    const { decision, result } = await evaluateAndMaybeExecute(
      { toolName: body.tool_name, args: body.args ?? {}, context: ctx },
      {},
    );
    if (!body.execute) return { decision: decisionToJson(decision) };
    return { decision: decisionToJson(decision), result };
  });

  /**
   * POST /api/evaluate/scan — defense-in-depth PII + secrets + injection scan
   * for a string. Mirrors the `shield.scan_input_v2` MCP tool.
   */
  app.post('/scan', async (req, reply) => {
    const { text } = (req.body ?? {}) as { text?: string };
    if (typeof text !== 'string') {
      return reply.code(400).send({ error: 'text (string) required' });
    }
    const injection = detectInjectionV2(text);
    const pii = detectPIIv2(text);
    const secrets = detectSecrets(text);
    return {
      injection: {
        detected: injection.detected,
        risk: injection.risk,
        confidence: injection.confidence,
        evidence: injection.evidence,
        canonical: injection.canonical,
      },
      pii: {
        findings: pii.findings.map((f) => ({
          type: f.type,
          confidence: f.confidence,
          validators: f.validators,
          contextHint: f.contextHint,
          field: f.field,
          sample: f.sample.slice(0, 6) + '…',
        })),
        maxConfidence: pii.maxConfidence,
        redacted: pii.redacted,
      },
      secrets: {
        found: secrets.found,
        count: secrets.matches.length,
      },
    };
  });

  /**
   * POST /api/evaluate/redact — redact PII / secrets from a string OR a JSON
   * object. Body: { text?, object? } — pass exactly one.
   */
  app.post('/redact', async (req, reply) => {
    const body = (req.body ?? {}) as { text?: string; object?: Record<string, unknown> };
    if (typeof body.text === 'string') {
      return { kind: 'string', redacted: redactPII(body.text) };
    }
    if (body.object && typeof body.object === 'object') {
      const result = detectPIIDeep(body.object);
      return {
        kind: 'object',
        redacted: result.redacted,
        findings: result.findings.map((f) => ({
          type: f.type,
          field: f.field,
          confidence: f.confidence,
          validators: f.validators,
        })),
      };
    }
    return reply.code(400).send({ error: 'pass either text (string) or object (record)' });
  });

  /**
   * POST /api/evaluate/compliance-tag — regulatory-hint detector. Emits PCI /
   * HIPAA / GDPR / CCPA / SOX / FERPA / DPDP signals with confidence + citation.
   * Body: { tool_name, args? }
   */
  app.post('/compliance-tag', async (req, reply) => {
    const body = (req.body ?? {}) as { tool_name?: string; args?: Record<string, unknown> };
    if (typeof body.tool_name !== 'string') {
      return reply.code(400).send({ error: 'tool_name (string) required' });
    }
    const args = body.args ?? {};
    // Run the v2 PII detector across all string args to feed compliance.
    const flat = Object.values(args).filter((v): v is string => typeof v === 'string').join('\n');
    const piiScan = detectPIIv2(flat);
    const result = evaluateRegulatoryHints({
      toolName: body.tool_name,
      args,
      piiFindings: piiScan.findings,
    });
    return result;
  });

  /**
   * POST /api/evaluate/sanitize-output — wrap tool output that contains
   * injection patterns as untrusted data so the downstream model treats it
   * as data, not instructions. Body: { text, source? }
   */
  app.post('/sanitize-output', async (req, reply) => {
    const body = (req.body ?? {}) as { text?: string; source?: 'tool' | 'browser' | 'file' };
    if (typeof body.text !== 'string') {
      return reply.code(400).send({ error: 'text (string) required' });
    }
    return sanitizeToolOutput(body.text, body.source ?? 'tool');
  });
};
