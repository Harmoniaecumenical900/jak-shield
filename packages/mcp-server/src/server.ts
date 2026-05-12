import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from './zod-to-json.js';
import { SHIELD_TOOLS } from './shield-tools.js';
import { listConnectorTools } from '@jak-shield/connectors-registry';
import { registerAllConnectors } from '@jak-shield/connectors-bundle';
import { createLogger } from '@jak-shield/shared';
import { evaluateAndMaybeExecute, makeContext } from './evaluate.js';

const log = createLogger('mcp-server');

let connectorsRegistered = false;
function ensureConnectors(): void {
  if (connectorsRegistered) return;
  registerAllConnectors();
  connectorsRegistered = true;
}

export function createShieldServer(): Server {
  ensureConnectors();

  const server = new Server(
    { name: 'jak-shield', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const shieldTools = SHIELD_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema),
    }));
    const protectedTools = listConnectorTools().map((m) => ({
      name: m.name,
      description: m.description ?? '',
      inputSchema: m.inputSchema ?? { type: 'object' },
    }));
    return { tools: [...shieldTools, ...protectedTools] };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;

    // shield.* tools have explicit handlers.
    const shieldDef = SHIELD_TOOLS.find((t) => t.name === name);
    if (shieldDef) {
      try {
        const parsed = shieldDef.inputSchema.parse(args ?? {});
        const result = await shieldDef.handler(parsed);
        return { content: [{ type: 'text', text: jsonOut(result) }] };
      } catch (err) {
        log.error(`shield handler '${name}' failed`, (err as Error).message);
        return { content: [{ type: 'text', text: jsonOut({ error: (err as Error).message }) }], isError: true };
      }
    }

    // Anything else: treat as a connector call routed through evaluate-then-execute.
    const ctx = makeContext({ clientName: 'mcp-client' });
    const { decision, result } = await evaluateAndMaybeExecute(
      { toolName: name, args: (args ?? {}) as Record<string, unknown>, context: ctx },
      {},
    );
    return {
      content: [{ type: 'text', text: jsonOut({ decision: decision, result }) }],
      isError: result?.success === false || decision.action === 'block',
    };
  });

  return server;
}

function jsonOut(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
