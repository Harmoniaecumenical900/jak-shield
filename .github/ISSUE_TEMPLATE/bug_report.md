---
name: 🐛 Bug report
about: Something in JAK Shield isn't behaving the way the docs say it should
title: "[BUG] "
labels: bug, triage
assignees: ''
---

## What happened

<!-- Plain-English description. Less than 3 sentences if you can. -->

## Minimal reproducer

```jsonc
// Paste the exact shield_evaluate_tool_call / shield_proxy_tool_call request:
{
  "tool_name": "...",
  "args": { ... }
}
```

## What you expected

<!-- e.g. expected action=block, got action=allow -->

## What you got

```json
// paste the full decision JSON, including provenance, signature, compliance
```

## Environment

- JAK Shield version: `git rev-parse HEAD` →
- Install method: [ ] Claude Desktop  [ ] Cursor  [ ] VS Code  [ ] OpenAI Agents SDK  [ ] curl  [ ] Docker Compose
- Node version: `node --version` →
- OS: macOS / Linux / Windows
- DATABASE_URL set? [ ] yes (Postgres-backed)  [ ] no (in-memory)

## Anything else

<!-- Logs, screenshots, the agent's full thread, anything you think helps. -->

---

By submitting this issue I confirm:

- [ ] I am not reporting a security vulnerability (those go to security@jakshield.ai per [SECURITY.md](../SECURITY.md))
- [ ] I have searched existing issues for duplicates
- [ ] The reproducer above does NOT contain real PII or secrets
