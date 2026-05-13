## Title

```
👋 Welcome — what brought you here?
```

## Body (3 sentences — paste as-is or edit in your voice)

Hey 👋 — JAK Shield is here because every AI agent in 2026 can send email, query Postgres, run shell, and post to Slack, but none of them ask first. I built this as the security layer that sits between any MCP-compatible client and the real tools, blocks the obviously bad calls, redacts PII, asks a human about the ambiguous ones, and keeps watching even after you override. Tell me what brought you here — what tool call is keeping you up at night?

## Alternative 4-sentence version

JAK Shield exists because I got tired of watching agents call shell, postgres, and gmail without anyone checking what they're about to do. The MCP-native gateway here intercepts every tool call, runs it through a deterministic policy engine + PII / injection / taint scanners, and either allows, blocks, redacts, or asks for human approval — and v0.2 added "block override with heightened scrutiny" so when you do override a block, JAK Shield doesn't just stand down, it tightens its thresholds and watches more closely. The code is MIT, the rules are readable, and the bench is 45/45. Tell me what brought you here, what you're trying to protect, and what tool call you wish someone had stopped last week.

## Notes for posting

- The short version reads more conversational and matches your row 5 spec
- The 4-sentence version mentions the v0.2 feature explicitly — useful if you want to anchor the conversation around what's new
- Either way, hit **Pin Discussion** after posting (`…` menu on the top right of the discussion page)
