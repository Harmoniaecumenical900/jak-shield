# PR draft — `punkpeye/awesome-mcp-servers`

Submit JAK Shield to the most-starred MCP discovery repo. The repo currently
has ~12K stars; landing in the right section drives a long tail of installs.

---

## Step 1 — Fork and clone

```bash
gh repo fork punkpeye/awesome-mcp-servers --clone
cd awesome-mcp-servers
git checkout -b add-jak-shield
```

## Step 2 — Add the entry

Open `README.md` and find the **Security** section (search for `## 🔒 Security`).
Add this line in alphabetical order:

```markdown
- [JAK Shield](https://github.com/inbharatai/jak-shield) 🛡️ — Universal security gateway for AI agents. Sits between any MCP client and real tools; blocks destructive actions, redacts 28 PII types with cryptographic checksum validators, detects prompt injection across 13 non-English languages + 6 detection stages, tracks taint across calls (novel for MCP), requires human approval, HMAC-signed decisions, capability tokens, regulatory hints (PCI/HIPAA/GDPR/SOX/FERPA/DPDP). 45-scenario adversarial benchmark in CI. MIT, TypeScript.
```

If there's no Security section, add the entry under **"Server frameworks and tools"** or **"Other tools and integrations"** — whichever exists at the time you fork.

## Step 3 — Commit + push + open PR

```bash
git add README.md
git commit -m "Add JAK Shield — MCP-native security gateway"
git push -u origin add-jak-shield
gh pr create --title "Add JAK Shield — MCP-native security gateway" \
  --body "$(cat <<'EOF'
JAK Shield is an open-source security gateway that sits between any
MCP-compatible AI client (Claude Desktop, Cursor, VS Code, OpenAI Agents
SDK) and the real tools the agent calls.

Adds defense-in-depth to the MCP tool-call boundary:

- 8 deterministic policy rules + RBAC + approval queue
- PII detection across 28 types with Luhn / Verhoeff / mod-97 / ABA / mod-11 checksum validators
- Prompt-injection detection in 6 stages across 13 non-English languages
- Cross-call taint tracking with MinHash + n-gram fingerprinting (novel for MCP)
- 20 attack-chain patterns with data-flow tracking
- EWMA + z-score behavioral anomaly detection
- Short-lived, single-use, scope-bound capability tokens
- HMAC-signed decisions with key rotation
- Regulatory hints (PCI/HIPAA/GDPR/SOX/FERPA/DPDP) with citations + disclaimer
- 45-scenario adversarial benchmark in CI, p95 latency < 1 ms

Repo: https://github.com/inbharatai/jak-shield
License: MIT
Works with: Claude Desktop, Claude Code, Anthropic API, OpenAI Agents SDK, OpenAI Responses API, Cursor, VS Code, Cline, Windsurf, Zed, Goose, Continue, Mastra, n8n, LibreChat, LangChain, LlamaIndex, plus adapters for ChatGPT Custom GPTs and Gemini.
EOF
)"
```

## Step 4 — While waiting, also submit to:

- **MCP.so** — https://mcp.so/submit (similar registry, smaller audience)
- **Smithery** — `smithery.yaml` is at the repo root, run `npm i -g @smithery/cli && smithery publish`
- **Cline marketplace** — opens automatically when smithery is approved
- **Cursor MCP marketplace** — when Cursor opens theirs (announced for 2026)
