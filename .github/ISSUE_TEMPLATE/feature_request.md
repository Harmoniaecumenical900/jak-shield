---
name: ✨ Feature request
about: Propose a new detector, connector, MCP tool, or policy rule
title: "[FEATURE] "
labels: enhancement, triage
assignees: ''
---

## What problem does this solve

<!-- The concrete agent scenario JAK Shield is missing today. -->

## Proposed change

<!-- Where in the codebase, roughly. Examples:
   - New PII type CPF with cpfValid() validator in packages/dlp/src/validators.ts
   - New attack-chain pattern "browser → SQL UPDATE" in packages/policy-engine/src/attack-chains.ts
   - New connector for Notion API in packages/connectors/notion/
-->

## Alternatives considered

<!-- e.g. "Could be a soft rule instead of hard block because…" -->

## Risk assessment

If this proposal lands, what is the potential blast radius if it goes wrong?

- [ ] Safe — additive only
- [ ] Touches `decide()` ordering — could change existing decisions
- [ ] Touches signing canonical form — would require key rotation
- [ ] Touches connectors — needs taint-tracker review
- [ ] Touches dashboard — UX implications

## Will you contribute the implementation?

- [ ] Yes, I'll open a PR
- [ ] Yes, with help — happy to pair on Discord
- [ ] No, just filing the idea
