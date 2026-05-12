import type { FastifyPluginAsync } from 'fastify';
import { evaluateAndMaybeExecute, makeContext } from '@jak-shield/mcp-server';
import { decisionToJson } from '@jak-shield/core';

export const evaluateRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /api/evaluate
   * Body: { tool_name, args, context?, execute? }
   * Returns the policy decision; if execute=true, also runs the tool.
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
    if (!body.execute) {
      return { decision: decisionToJson(decision) };
    }
    return { decision: decisionToJson(decision), result };
  });
};
