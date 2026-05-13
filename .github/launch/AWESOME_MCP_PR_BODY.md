JAK Shield is an open-source security gateway that sits between any
MCP-compatible AI client (Claude Desktop, Cursor, VS Code, Cline, Windsurf,
Zed, OpenAI Agents SDK) and the real tools the agent calls.

Adds defense-in-depth to the MCP tool-call boundary:

- 8 deterministic policy rules + RBAC + approval queue
- PII detection across 28 types with Luhn / Verhoeff / mod-97 / ABA / mod-11 checksum validators
- Prompt-injection detection in 6 stages across 13 non-English languages + English baseline
- Cross-call taint tracking with MinHash + n-gram fingerprinting
- 20 attack-chain patterns with data-flow tracking + time-decay weighting
- EWMA + z-score behavioral anomaly detection, multi-window, per-tenant + per-agent
- **Block override with heightened scrutiny** *(v0.2)* — overridable blocks surface what + why + worst-case; CRITICAL blocks (`rm -rf /`, `DROP TABLE`, prod-deploy, payments) stay non-overridable; accepting an override tightens anomaly + taint thresholds for the next ~10 calls; any further block in that window is unconditionally hard-block
- Short-lived, single-use, scope-bound capability tokens (HMAC-signed JWT)
- HMAC-SHA256 signed decisions with key rotation
- Regulatory hints (PCI / HIPAA / GDPR / SOX / FERPA / DPDP / CCPA) with citations + an explicit "not legal advice" disclaimer
- 45-scenario adversarial benchmark in CI passing 45/45
- p95 evaluation latency ~2.3 ms end-to-end through MCP stdio on a developer laptop

Repo: https://github.com/inbharatai/jak-shield
License: MIT

Works with: Claude Desktop, Claude Code, Anthropic API, OpenAI Agents SDK,
OpenAI Responses API, Cursor, VS Code, Cline, Windsurf, Zed, Goose,
Continue, Mastra, n8n, LibreChat, LangChain (Python + JS), LlamaIndex,
CrewAI, Vercel AI SDK, Pydantic AI, plus an OpenAPI 3.1 spec for ChatGPT
Custom GPTs and Gemini function declarations.

Happy to re-sort alphabetically or move the entry to a different section
if you'd prefer.
