<!-- Thank you for contributing to JAK Shield. -->

## Summary

<!-- What does this PR do, in one paragraph? -->

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would change existing behavior)
- [ ] New detector / pattern / connector
- [ ] Documentation / README / launch comms
- [ ] CI / build / tooling
- [ ] Performance improvement

## Linked issues

Closes #
Related to #

## Tests

- [ ] `pnpm -r --filter '!@jak-shield/dashboard' test` — **all 147+ passing**
- [ ] `pnpm bench` — **45/45 (no regressions)**
- [ ] `node bench/perf-bench.mjs` — **p95 < 50 ms**
- [ ] Added new test(s) covering this change *(required for new code paths)*
- [ ] Added a scenario in `bench/scenarios.json` *(required for new detectors)*

## Signature safety (if touching `decide()` / signing / canonical form)

- [ ] Re-ran `packages/core/src/__tests__/sign-decision.test.ts` — including the regression test for the approvalId mutation bug
- [ ] No change to the canonical-form field list, OR migration documented in CHANGELOG

## Docs

- [ ] README updated if user-facing
- [ ] CHANGELOG entry under `[Unreleased]`
- [ ] JSDoc on new public APIs

## Screenshots / output (if UI or output format changed)

<!-- Paste here -->

## Checklist

- [ ] My code follows the existing style (TS strict, no `as any`, no `as never`)
- [ ] I have performed a self-review
- [ ] I have commented complex bits
- [ ] Code of Conduct understood
