# JAK Shield platform adapters

Not every AI tool speaks MCP yet. These adapters let JAK Shield gate tool calls coming from non-MCP platforms — without you writing the integration plumbing yourself.

| Adapter | For | Status |
|---|---|---|
| [`openapi/`](./openapi) | ChatGPT Custom GPTs / Actions, OpenAPI-consuming clients (Postman, Stainless) | ✅ Ready — paste yaml into ChatGPT Actions editor |
| [`langchain/python/`](./langchain/python) | LangChain (Python), LangGraph, AutoGen, LlamaIndex | ✅ Ready — `pip install -e .` |
| [`langchain/js/`](./langchain/js) | LangChain.js, LangGraph.js | ✅ Ready — `pnpm build` |
| [`gemini/`](./gemini) | Google Gemini (`@google/genai`, `@google/generative-ai`, Vertex AI, Gemini CLI) | ✅ Ready — `pnpm build` |
| [`crewai/`](./crewai) | **CrewAI native** (≥ 0.80) — separate from LangChain compat | ✅ Ready — `pip install -e .` |
| [`vercel-ai/`](./vercel-ai) | **Vercel AI SDK v4+** (Next.js, Edge runtime, Cloudflare Workers, Node.js) | ✅ Ready — `pnpm build` |
| [`pydantic-ai/`](./pydantic-ai) | **Pydantic AI** (≥ 0.0.30) — async-first Python agents | ✅ Ready — `pip install -e .` |

## Why adapters exist

The Model Context Protocol is becoming the standard for AI tool calling, but adoption isn't universal yet:

- ✅ **MCP-native today (no adapter needed):** Claude Desktop · Claude Code · Anthropic API · OpenAI Agents SDK · OpenAI Responses API · Cursor · VS Code (+ Cline/Roo Code) · Windsurf · Zed · Goose · Continue · Mastra · n8n · LibreChat · LangChain (via `MultiServerMCPClient`) · LlamaIndex (via `BasicMCPClient`) · any client built with the official MCP SDKs
- ⚙️ **Needs an adapter (these directories):** ChatGPT Custom GPTs · Google Gemini · Vercel AI SDK · CrewAI · Pydantic AI · xAI Grok · DeepSeek · Mistral · Cohere · AutoGen / LangGraph in their pure form
- ❌ **No path yet:** ChatGPT consumer chat (no API), Gemini consumer chat (no plugins), voice assistants (different ecosystem)

## Shared shape across all adapters

Every adapter exposes the same four operations (this is intentional — once you've learned one, you've learned them all):

| Operation | Purpose |
|---|---|
| `evaluate(tool_name, args)` | Decide if a planned tool call is safe |
| `scan(text)` | Defense-in-depth scan for PII, secrets, injection |
| `redact(text \| object)` | Strip PII before forwarding |
| `compliance_tag(tool_name, args)` | Regulatory hints with citations |

Plus a **`gate(tool)`** wrapper in every adapter that wraps an existing tool so its invocations are evaluated by JAK Shield first — block → throws, requires_approval → throws with approval_id, redact → invokes the inner tool with redacted args.

The full MCP surface (20 `shield.*` tools + 24 connectors + capability tokens + signed decisions) is only exposed via the MCP protocol itself. Adapters trade completeness for portability.

## Build all adapters

From the repo root:

```bash
pnpm install
pnpm --filter "@jak-shield/langchain"  build
pnpm --filter "@jak-shield/gemini"     build
pnpm --filter "@jak-shield/vercel-ai"  build

# Python adapters:
pip install -e packages/adapters/langchain/python
pip install -e packages/adapters/crewai
pip install -e packages/adapters/pydantic-ai
```

## Required REST endpoints

All adapters call the JAK Shield REST API at:

- `POST /api/evaluate` — full policy decision
- `POST /api/evaluate/scan` — defense-in-depth scan
- `POST /api/evaluate/redact` — redact PII / secrets
- `POST /api/evaluate/compliance-tag` — regulatory hints
- `POST /api/evaluate/sanitize-output` — wrap tool output as untrusted

All endpoints are implemented in `apps/api/src/routes/evaluate.ts` and auth via Bearer `jks_…` API key.

## Adapter you want isn't here?

Open a [feature request](../../../../issues/new?template=feature_request.md) with the target platform name. Adapters average ~200 lines and we accept PRs.

Pre-prioritized:

- 🟡 AutoGen 0.4+ native (Microsoft Agent Framework)
- 🟡 xAI Grok function-calling
- 🟡 Mistral / Cohere native tool formats
- 🟡 Haystack
- 🟡 Semantic Kernel (C# / Python)
- 🟡 Smolagents (HuggingFace)
- 🟡 Dust agents
- 🟡 Inkeep
- 🟡 Bedrock Agents

The REST API at `POST /api/evaluate` accepts any JSON, so a basic adapter for any platform is ~30 lines of HTTP wrapper code in your language of choice.
