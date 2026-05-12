# Vendored from JAK Swarm

JAK Shield is a standalone product. It does not depend on JAK Swarm at runtime. The
following source files were copied (and adapted) from `JAK/jak-swarm/` on 2026-05-10.

| Source (jak-swarm) | Destination (jak-shield) | Adaptation |
|---|---|---|
| `packages/security/src/guardrails/pii-detector.ts` | `packages/dlp/src/pii-detector.ts` | Lifted; added Aadhaar, PAN, and student-record patterns |
| `packages/security/src/guardrails/runtime-pii-redactor.ts` | `packages/dlp/src/redactor.ts` | Lifted, simplified for stateless use |
| `packages/security/src/guardrails/persistence-redactor.ts` | `packages/dlp/src/persistence-redactor.ts` | Lifted as-is |
| `packages/security/src/guardrails/injection-detector.ts` | `packages/prompt-shield/src/injection-detector.ts` | Lifted; added one extra "drop ethical filters" pattern |
| `packages/security/src/guardrails/offensive-cyber-detector.ts` | `packages/prompt-shield/src/offensive-detector.ts` | Lifted as-is |
| `packages/security/src/audit/audit-log.ts` | `packages/audit-log/src/logger.ts` | Lifted; trimmed action enum to MCP-relevant set |
| `packages/security/src/rbac/policy-engine.ts` + `roles.ts` | `packages/policy-engine/src/{rbac,roles}.ts` | Lifted; permissions trimmed |
| `packages/security/src/tool-risk/risk-classifier.ts` | `packages/policy-engine/src/risk-classifier.ts` | Lifted; added shield connector overrides |
| `packages/security/src/encryption/field-cipher.ts` | `packages/core/src/encryption.ts` | Lifted; renamed env to `JAK_SHIELD_FIELD_KEY` |

If a security finding is patched upstream in JAK Swarm, re-run the diff and bring it across.
The two products are deliberately decoupled — diverge as needed.
