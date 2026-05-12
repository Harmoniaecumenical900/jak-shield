---
name: 🎯 Detector miss / evasion
about: An attack input that JAK Shield SHOULD have flagged but didn't (or vice versa — a false positive)
title: "[MISS] "
labels: detector-miss, high-priority
assignees: ''
---

> **High-priority.** These are the most valuable bug reports for a security tool. Thank you in advance.

## Type of miss

- [ ] False negative — Shield allowed something it should have blocked / flagged
- [ ] False positive — Shield blocked something it should have allowed

## Input

```text
<paste the literal text / args that Shield processed>
```

## What Shield returned

```json
// shield_evaluate_tool_call or shield_scan_input_v2 full response
```

## What you expected

- Expected action: `block` / `requires_approval` / `redact` / `allow`
- Expected rule / detector: `dangerous-sql` / `external-email-pii` / `injection:unicode` / etc.

## Severity (your estimate)

- [ ] CRITICAL — bypasses Shield entirely for a real attack class
- [ ] HIGH — evades multiple detectors with simple obfuscation
- [ ] MEDIUM — evades one specific stage, others still catch it
- [ ] LOW — edge case / cosmetic

## Provenance

If this is from published research or a CTF write-up, link it. If it's your own work, that's totally fine — happy to credit you in `HALL_OF_FAME.md` and the next release notes.

---

**No PII please.** If your reproducer uses real personal data, redact it before submitting — we'll trust your description of why the detector misses.
