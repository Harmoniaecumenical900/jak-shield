# JAK Shield → Google Gemini adapter

Use JAK Shield's policy engine from any Gemini model — `@google/genai`, `@google/generative-ai`, Vertex AI, Gemini CLI, AI Studio.

## Install

```bash
# in the JAK Shield monorepo
pnpm --filter @jak-shield/gemini build

# or copy src/index.ts into your project
```

## What you get

- **`JAK_SHIELD_FUNCTION_DECLARATIONS`** — array of FunctionDeclarations ready to pass to Gemini as tools
- **`JakShieldGeminiClient`** — HTTP client for the Shield REST API
- **`handleFunctionCall(call, client)`** — dispatches a Gemini-emitted function call to JAK Shield and returns a Gemini-shaped FunctionResponse
- **`gate(tool, client)`** — wrap one of your own tool handlers so its invocations are evaluated by Shield first

## Quick start

```ts
import { GoogleGenAI } from '@google/genai';
import {
  JAK_SHIELD_FUNCTION_DECLARATIONS,
  JakShieldGeminiClient,
  handleFunctionCall,
} from '@jak-shield/gemini';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const shield = new JakShieldGeminiClient({
  baseUrl: 'https://shield.example.com/api',
  apiKey: process.env.JAK_SHIELD_API_KEY,
});

const result = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [
    { role: 'user', parts: [{ text: 'Should I send the customer roster to partner@external.com?' }] },
  ],
  config: {
    tools: [{ functionDeclarations: JAK_SHIELD_FUNCTION_DECLARATIONS }],
  },
});

const call = result.response.functionCalls?.[0];
if (call) {
  const fnResp = await handleFunctionCall(call, shield);
  // Send fnResp back to the model in the next turn so it can reason on Shield's decision.
}
```

## Or — gate one of your own tools

```ts
import { gate } from '@jak-shield/gemini';

const sendEmail = {
  name: 'send_email',
  description: 'Send an email via Gmail',
  invoke: async (args) => myGmailClient.send(args),
};

const safeSend = gate(sendEmail, shield);
// safeSend.invoke({...}) now blocks / approves / redacts via JAK Shield first.
```

## Recommended system prompt

> Before calling any tool that touches external systems, PII, databases, or
> shell commands, FIRST call `jak_shield_evaluate` with the planned tool name
> and args. If the decision is `block` or `requires_approval`, STOP and
> explain. If `redact`, use the redacted args from the response. Always
> surface compliance tags + the disclaimer to the user.

## What this is NOT

- Not the full MCP surface (20 `shield.*` tools + 24 connectors). For that, use Gemini via an MCP-compatible client. The four operations exposed here cover the high-value path: evaluate, scan, redact, compliance-tag.
- The function declarations work with any client that follows the Gemini FunctionDeclaration spec — but `handleFunctionCall` uses Node's `fetch`. For browser / Workers, pass a `fetchImpl`.

License: MIT.
