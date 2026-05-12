/**
 * Minimal OpenAI Agents SDK example: connect to the JAK Shield remote MCP gateway
 * and gate every tool call through it.
 *
 * Prereqs:
 *   npm i openai
 *   pnpm --filter @jak-shield/mcp-server dev:http   # starts http://localhost:4101/mcp
 *
 * Then run this file with `node` (transpile first or use tsx).
 */

import OpenAI from 'openai';

const client = new OpenAI();

async function main() {
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? 'gpt-5.4',
    input: 'Write a short greeting to demo@example.com via Gmail.',
    tools: [
      {
        type: 'mcp',
        server_label: 'jak-shield',
        server_url: process.env.SHIELD_MCP_URL ?? 'http://localhost:4101/mcp',
        require_approval: 'never', // JAK Shield's own approval gate handles this
      },
    ],
  });

  console.log(response.output_text);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
