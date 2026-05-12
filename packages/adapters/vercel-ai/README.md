# JAK Shield → Vercel AI SDK adapter

Native Vercel AI SDK v4+ integration. Works in Next.js API routes, Server Components, the Edge runtime, Node.js, and Cloudflare Workers.

## Install

```bash
pnpm add @jak-shield/vercel-ai ai zod
```

## Quick start

```ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { JakShieldClient, jakShieldTools, gate } from '@jak-shield/vercel-ai';

const shield = new JakShieldClient({
  baseUrl: process.env.JAK_SHIELD_URL!,
  apiKey: process.env.JAK_SHIELD_API_KEY,
});

const { text } = await generateText({
  model: openai('gpt-4o-mini'),
  tools: {
    ...jakShieldTools(shield),
    send_email: gate(myEmailTool, shield, 'send_email'),
  },
  prompt: 'Should I send the customer roster to partner@external.com?',
});
```

## Next.js API route example

```ts
// app/api/chat/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { JakShieldClient, jakShieldTools } from '@jak-shield/vercel-ai';

const shield = new JakShieldClient({
  baseUrl: process.env.JAK_SHIELD_URL!,
  apiKey: process.env.JAK_SHIELD_API_KEY,
});

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({
    model: openai('gpt-4o-mini'),
    tools: jakShieldTools(shield),
    messages,
  });
  return result.toDataStreamResponse();
}
```

## Edge runtime example

```ts
// edge route in Next.js or Cloudflare Worker
export const runtime = 'edge';

import { JakShieldClient } from '@jak-shield/vercel-ai';

const shield = new JakShieldClient({
  baseUrl: process.env.JAK_SHIELD_URL!,
  apiKey: process.env.JAK_SHIELD_API_KEY,
  fetchImpl: globalThis.fetch, // explicit on edge if you need a custom impl
});
```

## Gate an existing tool

```ts
import { tool } from 'ai';
import { z } from 'zod';
import { gate } from '@jak-shield/vercel-ai';

const sendEmail = tool({
  description: 'Send an email via Gmail',
  parameters: z.object({ to: z.string(), subject: z.string(), body: z.string() }),
  execute: async ({ to, subject, body }) => myGmailClient.send({ to, subject, body }),
});

const safeSend = gate(sendEmail, shield, 'send_email');
// safeSend throws if JAK Shield blocks; runs with redacted args on `redact`.
```

## System prompt suggestion

> Before calling any tool that touches external systems, PII, databases, or
> shell commands, FIRST call `jak_shield_evaluate` with the planned tool name
> and args. If the decision is `block` or `requires_approval`, STOP and
> explain. If `redact`, use the redacted args. Always surface compliance
> tags + the disclaimer.

License: MIT.
