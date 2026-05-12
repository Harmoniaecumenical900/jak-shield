# JAK Shield platform adapters

Not every AI tool speaks MCP yet. These adapters let JAK Shield gate tool calls coming from non-MCP platforms — without you writing the integration plumbing yourself.

| Adapter | For | Status |
|---|---|---|
| [`openapi/`](./openapi) | ChatGPT Custom GPTs / Actions, OpenAPI-consuming clients (Postman, Stainless) | ✅ Ready — paste yaml into ChatGPT Actions editor |
| [`langchain/python/`](./langchain/python) | LangChain (Python), LangGraph, CrewAI, AutoGen, LlamaIndex | ✅ Ready — `pip install -e .` |
| [`langchain/js/`](./langchain/js) | LangChain.js, LangGraph.js | ✅ Ready — `pnpm build` |
| [`gemini/`](./gemini) | Google Gemini (`@google/genai`, `@google/generative-ai`, Vertex AI, Gemini CLI) | ✅ Ready — `pnpm build` |

## Why adapters exist

The Model Context Protocol is becoming the standard for AI tool calling, but adoption isn't universal yet:

- ✅ **MCP-native today (no adapter needed):** Claude Desktop · Claude Code · Anthropic API · OpenAI Agents SDK · OpenAI Responses API · Cursor · VS Code (+ Cline/Roo Code) · Windsurf · Zed · Goose · Continue · Mastra · n8n · LibreChat · LangChain (via `MultiServerMCPClient`) · LlamaIndex (via `BasicMCPClient`) · any client built with the official MCP SDKs
- ⚙️ **Needs an adapter (these directories):** ChatGPT Custom GPTs · Google Gemini · xAI Grok · DeepSeek · Mistral · Cohere · CrewAI / AutoGen / LangGraph in their pure form
- ❌ **No path yet:** ChatGPT consumer chat (no API), Gemini consumer chat (no plugins), voice assistants (different ecosystem)

## Shared shape across all adapters

Every adapter exposes the same four operations (this is intentional — once you've learned one, you've learned them all):

| Operation | Purpose |
|---|---|
| `evaluate(tool_name, args)` | Decide if a planned tool call is safe |
| `scan(text)` | Defense-in-depth scan for PII, secrets, injection |
| `redact(text \| object)` | Strip PII before forwarding |
| `compliance_tag(tool_name, args)` | Regulatory hints with citations |

The full MCP surface (20 `shield.*` tools + 24 connectors + capability tokens + signed decisions) is only exposed via the MCP protocol itself. Adapters trade completeness for portability.

## Build all adapters

From the repo root:

```bash
pnpm install
pnpm --filter "@jak-shield/langchain" build
pnpm --filter "@jak-shield/gemini" build
# Python adapter:
pip install -e packages/adapters/langchain/python
```

## Adapter you want isn't here?

Open a [feature request](../../../../issues/new?template=feature_request.md) with the target platform name. Adapters average ~200 lines and we accept PRs.

Pre-prioritized:

- 🟡 CrewAI native (separate from LangChain)
- 🟡 AutoGen 0.4+ (Microsoft Agent Framework)
- 🟡 xAI Grok function-calling
- 🟡 Mistral / Cohere native tool formats
- 🟡 Vercel AI SDK
- 🟡 Pydantic AI
- 🟡 Haystack
- 🟡 Semantic Kernel (C# / Python)

The REST API at `POST /api/evaluate` accepts any JSON, so a basic adapter for any platform is ~30 lines of HTTP wrapper code in your language of choice.
