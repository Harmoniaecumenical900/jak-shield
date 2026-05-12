"""
JAK Shield ↔ Pydantic AI adapter.

Pydantic AI's Agent registers tools as plain async/sync Python functions
with typed parameters. This module exports:

  - `JakShieldClient` — REST client for the JAK Shield API
  - `register_jak_shield_tools(agent, shield)` — registers the four core
    Shield tools onto a Pydantic AI Agent in one call
  - `gate(fn, shield, tool_name)` — wrap any function so its invocations
    are evaluated by JAK Shield first
  - Individual `jak_shield_*` callables for selective registration

Usage:

    from pydantic_ai import Agent
    from jak_shield_pydantic_ai import JakShieldClient, register_jak_shield_tools

    shield = JakShieldClient(base_url="https://shield.example.com/api",
                             api_key="jks_…")

    agent = Agent('openai:gpt-4o-mini',
                  system_prompt='Always call jak_shield_evaluate before any '
                                'external action.')
    register_jak_shield_tools(agent, shield)

    result = await agent.run('Should I send the SSN list to partner@external.com?')

Requirements:
    pip install pydantic-ai httpx pydantic

License: MIT (same as JAK Shield itself)
"""

from __future__ import annotations

import os
from typing import Any, Callable, Dict, Optional, TypeVar, ParamSpec, Awaitable

import httpx
from pydantic_ai import Agent, RunContext


# -------------------- Client --------------------------------------------------

class JakShieldClient:
    """HTTP client for the JAK Shield REST API."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout_seconds: float = 5.0,
    ) -> None:
        self.base_url = (base_url or os.environ.get("JAK_SHIELD_URL", "")).rstrip("/")
        if not self.base_url:
            raise ValueError("JAK_SHIELD_URL not set and base_url not provided")
        self.api_key = api_key or os.environ.get("JAK_SHIELD_API_KEY")
        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        # async client — Pydantic AI prefers async tools
        self._client = httpx.AsyncClient(
            base_url=self.base_url, timeout=timeout_seconds, headers=headers
        )

    async def evaluate(
        self,
        tool_name: str,
        args: Optional[Dict[str, Any]] = None,
        execute: bool = False,
    ) -> Dict[str, Any]:
        r = await self._client.post(
            "/evaluate",
            json={"tool_name": tool_name, "args": args or {}, "execute": execute},
        )
        r.raise_for_status()
        return r.json()

    async def scan(self, text: str) -> Dict[str, Any]:
        r = await self._client.post("/evaluate/scan", json={"text": text})
        r.raise_for_status()
        return r.json()

    async def redact(
        self, text: Optional[str] = None, obj: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        body: Dict[str, Any] = {}
        if text is not None:
            body["text"] = text
        if obj is not None:
            body["object"] = obj
        r = await self._client.post("/evaluate/redact", json=body)
        r.raise_for_status()
        return r.json()

    async def compliance_tag(
        self, tool_name: str, args: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        r = await self._client.post(
            "/evaluate/compliance-tag",
            json={"tool_name": tool_name, "args": args or {}},
        )
        r.raise_for_status()
        return r.json()

    async def aclose(self) -> None:
        await self._client.aclose()


# -------------------- Tool registration ---------------------------------------

def register_jak_shield_tools(agent: Agent, shield: JakShieldClient) -> None:
    """Register the four canonical JAK Shield tools onto an Agent.

    The agent will be able to call them like any other Pydantic AI tool.
    """

    @agent.tool
    async def jak_shield_evaluate(
        _ctx: RunContext,
        tool_name: str,
        args: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        """Evaluate a planned tool call against JAK Shield. Returns a decision
        (allow / block / requires_approval / redact / rewrite) with full
        evidence tree, HMAC signature, and compliance hints. CALL THIS BEFORE
        running any tool that touches external systems, PII, databases, or
        shell commands.

        :param tool_name: MCP tool name (e.g. gmail.send_email, postgres.query).
        :param args: Args the agent intends to pass to the tool.
        """
        return await shield.evaluate(tool_name, args or {})

    @agent.tool
    async def jak_shield_scan(_ctx: RunContext, text: str) -> Dict[str, Any]:
        """Defense-in-depth scan of a string for PII (28 types with cryptographic
        validators), secrets, and prompt injection across 13 non-English
        languages and 6 detection stages. Returns evidence tree, redacted text,
        and per-finding confidence.

        :param text: The string to scan.
        """
        return await shield.scan(text)

    @agent.tool
    async def jak_shield_redact(
        _ctx: RunContext,
        text: str | None = None,
        obj: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        """Redact PII and secrets from a string OR a JSON object. Pass exactly
        one of text or obj. Use BEFORE posting any potentially-sensitive
        payload to an external service.
        """
        return await shield.redact(text=text, obj=obj)

    @agent.tool
    async def jak_shield_compliance_tag(
        _ctx: RunContext,
        tool_name: str,
        args: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        """Tag a planned tool call with regulatory hints (PCI / HIPAA / GDPR /
        CCPA / SOX / FERPA / DPDP). These are TRIAGE SIGNALS — not legal
        compliance determinations. Always surface the returned disclaimer to
        the user.
        """
        return await shield.compliance_tag(tool_name, args or {})


# -------------------- gate() decorator ----------------------------------------

P = ParamSpec("P")
R = TypeVar("R")


class JakShieldBlocked(Exception):
    """Raised when JAK Shield blocks a gated tool call."""


class JakShieldApprovalRequired(Exception):
    """Raised when JAK Shield needs human approval for a gated call."""

    def __init__(self, approval_id: str | None, reason: str) -> None:
        super().__init__(reason)
        self.approval_id = approval_id


def gate(
    fn: Callable[P, Awaitable[R]],
    shield: JakShieldClient,
    tool_name: str,
) -> Callable[P, Awaitable[R]]:
    """Wrap an async tool function so JAK Shield evaluates every invocation
    first. Block / requires_approval raise. Redact runs the wrapped function
    with the redacted args returned by Shield.
    """

    async def wrapped(*args: P.args, **kwargs: P.kwargs) -> R:
        # Pydantic AI tools are typically keyword-only after RunContext.
        # We treat everything in kwargs as the args dict for evaluation.
        eval_args = dict(kwargs)
        result = await shield.evaluate(tool_name, eval_args)
        decision = result.get("decision") or {}
        action = decision.get("action")
        if action == "block":
            raise JakShieldBlocked(
                f"JAK Shield blocked '{tool_name}': {decision.get('reason')}. "
                f"Safe alternative: {decision.get('safe_alternative')}"
            )
        if action == "requires_approval":
            raise JakShieldApprovalRequired(
                decision.get("approval_id"),
                f"JAK Shield requires human approval for '{tool_name}': "
                f"{decision.get('reason')}",
            )
        if action == "redact":
            redacted = (decision.get("provenance") or {}).get("redactedArgs")
            if isinstance(redacted, dict):
                return await fn(*args, **redacted)  # type: ignore[arg-type]
        return await fn(*args, **kwargs)

    wrapped.__name__ = getattr(fn, "__name__", "gated_tool")
    wrapped.__doc__ = (
        f"[JAK Shield-gated] {fn.__doc__ or ''}"
    ).strip()
    return wrapped


__all__ = [
    "JakShieldClient",
    "register_jak_shield_tools",
    "gate",
    "JakShieldBlocked",
    "JakShieldApprovalRequired",
]
