# Security policy

## Supported versions

JAK Shield is pre-1.0. We support the latest `main` and the most recent tagged release. Older versions receive critical fixes only when commercially-supported customers depend on them.

| Version | Supported |
|---|---|
| `main` | ✅ |
| `v0.1.x` | ✅ |
| Anything older | ❌ |

## Reporting a vulnerability

**Do not open a public GitHub issue.**

Email **info@inbharat.ai** with:

- Affected component (e.g., `policy-engine`, `prompt-shield`, `connectors/shell`)
- Affected version (commit hash if `main`)
- Minimal reproducer
- Impact assessment
- Optional: your preferred handle for the public credit

We will:

1. Acknowledge within **72 hours**.
2. Investigate and provide a triage assessment within **7 days**.
3. Coordinate a disclosure date with you, typically **30 days** after a fix lands on `main`.
4. Credit you publicly in [`HALL_OF_FAME.md`](./HALL_OF_FAME.md) and the release notes (unless you prefer to stay anonymous).

## Scope

In scope:

- Bypasses of the policy engine — any path that lets a tool call reach a connector without `decide()` running
- PII / secrets / injection patterns that evade the v2 detectors (please include the evading input)
- Capability-token forgeries or replay attacks
- Decision-signature forgery
- Privilege escalation via tenant / API-key boundaries
- Sandbox escape from the filesystem / shell connectors
- AuthN / AuthZ flaws in the dashboard or REST API

Out of scope:

- Theoretical attacks against unimplemented hypothetical features
- Issues that require a compromised JAK Shield deployment (you have root → game over)
- Denial of service via valid policy decisions (that's the engine doing its job)
- Vulnerabilities in upstream dependencies that have an open advisory — we update via Dependabot

## Safe-harbour

We support security research conducted in good faith. We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, destruction of data, and interruption or degradation of our services
- Report vulnerabilities promptly using the process above
- Do not exploit vulnerabilities beyond what is needed to confirm them
- Do not publicly disclose vulnerabilities until we've had a reasonable chance to fix them

## Bug bounty

We don't have a formal bug bounty program *yet*. As soon as we secure sponsorship for one, this section will list the scopes and payouts. Meanwhile, top reporters get free Pro accounts when the SaaS launches + permanent credit.

---

**The honest part:** JAK Shield has not been pen-tested by an external firm and is not SOC 2 certified. We are pre-customer. If you find something serious, it's likely the first time anyone has looked at that path. Thank you in advance.
