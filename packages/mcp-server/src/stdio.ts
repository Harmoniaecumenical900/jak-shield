#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createShieldServer } from './server.js';
import { createLogger } from '@jak-shield/shared';

const log = createLogger('mcp-stdio');

async function main(): Promise<void> {
  const server = createShieldServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info('JAK Shield MCP server (stdio) ready');
}

main().catch((err) => {
  log.error('fatal', err);
  process.exit(1);
});
