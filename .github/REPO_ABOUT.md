# GitHub repo "About" panel — paste-ready

GitHub's About panel has three fields. The 350-char description limit is
the binding constraint.

---

## Description (recommended — 312 chars)

Paste this verbatim into Settings → General → About → Description:

```
The MCP-native security layer between AI agents and the real tools they call. Deterministic policy engine + 6-stage prompt-injection scan + 28 PII types with cryptographic checksums + cross-call taint tracking + signed decisions + block override with heightened scrutiny. MIT, 164 tests, 45/45 adversarial bench.
```

### Alternative descriptions

**Tighter (212 chars):**

```
MCP-native security gateway between AI agents and the tools they call. Blocks destructive actions, redacts PII, detects prompt injection, audits everything. Block override with heightened scrutiny. MIT.
```

**Action-first (262 chars):**

```
Stop AI agents from sending the SSN list to attacker@evil.com. MCP-native gateway that intercepts every tool call, redacts PII, blocks destructive SQL, requires human approval, surfaces signed evidence. Block override with one-strike scrutiny. MIT.
```

---

## Website

```
https://github.com/inbharatai/jak-shield
```

Replace with `https://jakshield.ai` once you own the domain.

---

## Topics (paste as space-separated, up to 20 — GitHub's limit)

```
mcp model-context-protocol ai-security ai-safety llm-security prompt-injection pii-detection guardrails ai-firewall agent-security mcp-server claude cursor vscode openai langchain crewai vercel-ai pydantic-ai gemini
```

That's 20 — GitHub's hard cap. If you want fewer / different ones, prune
from the right end (the last 5 are platform-specific). The first 10 are
the discovery keywords that drive search hits.

---

## Why each choice

- **`mcp` + `model-context-protocol`** — both, because some people search
  one and some the other. Cheap to include both.
- **`ai-security` + `ai-safety` + `llm-security`** — three near-synonyms,
  three search queries. All three are real high-volume queries.
- **`prompt-injection`, `pii-detection`** — the two best-known threats
  this addresses; high-intent searchers.
- **`guardrails`, `ai-firewall`** — category language people use to find
  products like this when they don't know the specific term.
- **`agent-security`** — captures the "I run agents that call tools" use
  case explicitly.
- **`mcp-server`** — implementation-level keyword for people building MCP
  servers and looking for examples.
- **Platform tags** (`claude`, `cursor`, `vscode`, `openai`, `langchain`,
  etc.) — every one of these tags has a stream of users searching for
  "thing that works with X." Joining those streams is how the repo gets
  discovered organically.

---

## Optional — repo "Features" toggles

Settings → General → Features. Recommended:

- ✅ Wikis — off (you have docs/ in the repo)
- ✅ Issues — on
- ✅ Sponsorships — on, point at the `inbharatai` sponsor profile
- ✅ Discussions — on (already enabled)
- ✅ Projects — off for now (no project board worth maintaining yet)
- ✅ Preserve this repository — on (archive snapshot)
