"""
JAK Shield ↔ CrewAI adapter (CrewAI >= 0.80).

Wraps the JAK Shield REST API as CrewAI BaseTool subclasses. Use these
directly on an Agent's tools list, or use `gate()` to wrap an existing
CrewAI tool so its invocations are evaluated by JAK Shield first.

Usage:

    from crewai import Agent, Task, Crew
    from jak_shield_crewai import JakShieldClient, jak_shield_tools, gate

    shield = JakShieldClient(base_url="https://shield.example.com/api",
                             api_key="jks_…")

    # Option 1: drop the Shield tools onto an Agent.
    analyst = Agent(
        role="Analyst",
        goal="Find risky outbound actions before they happen",
        backstory="...",
        tools=jak_shield_tools(shield),
    )

    # Option 2: gate one of your existing tools.
    from my_tools import send_email_tool
    safe_send = gate(send_email_tool, shield)

Requirements:
    pip install crewai pydantic httpx

License: MIT (same as JAK Shield itself)
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional, Type, List

import httpx
from pydantic import BaseModel, Field
from crewai.tools import BaseTool


# -------------------- Client --------------------------------------------------

class JakShieldClient:
    """HTTP client for the JAK Shield REST API.

    Reads JAK_SHIELD_URL and JAK_SHIELD_API_KEY from env if not passed.
    """

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
        self._client = httpx.Client(
            base_url=self.base_url, timeout=timeout_seconds, headers=headers
        )

    def evaluate(
        self,
        tool_name: str,
        args: Optional[Dict[str, Any]] = None,
        execute: bool = False,
    ) -> Dict[str, Any]:
        r = self._client.post(
            "/evaluate",
            json={"tool_name": tool_name, "args": args or {}, "execute": execute},
        )
        r.raise_for_status()
        return r.json()

    def scan(self, text: str) -> Dict[str, Any]:
        r = self._client.post("/evaluate/scan", json={"text": text})
        r.raise_for_status()
        return r.json()

    def redact(
        self, text: Optional[str] = None, obj: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        body: Dict[str, Any] = {}
        if text is not None:
            body["text"] = text
        if obj is not None:
            body["object"] = obj
        r = self._client.post("/evaluate/redact", json=body)
        r.raise_for_status()
        return r.json()

    def compliance_tag(
        self, tool_name: str, args: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        r = self._client.post(
            "/evaluate/compliance-tag",
            json={"tool_name": tool_name, "args": args or {}},
        )
        r.raise_for_status()
        return r.json()

    def close(self) -> None:
        self._client.close()


# -------------------- Schemas -------------------------------------------------

class _EvaluateSchema(BaseModel):
    tool_name: str = Field(description="MCP tool name to evaluate (e.g. gmail.send_email)")
    args: Dict[str, Any] = Field(
        default_factory=dict, description="Args the agent intends to pass"
    )


class _ScanSchema(BaseModel):
    text: str = Field(description="Text to scan for PII, secrets, and prompt injection")


class _RedactSchema(BaseModel):
    text: Optional[str] = Field(default=None, description="Pass either text OR object")
    obj: Optional[Dict[str, Any]] = Field(
        default=None, description="JSON to walk recursively"
    )


class _ComplianceSchema(BaseModel):
    tool_name: str
    args: Dict[str, Any] = Field(default_factory=dict)


# -------------------- Tools ---------------------------------------------------

class JakShieldEvaluateTool(BaseTool):
    name: str = "jak_shield_evaluate"
    description: str = (
        "Evaluate a planned tool call against JAK Shield. Returns a decision "
        "(allow / block / requires_approval / redact / rewrite) with full "
        "evidence tree and compliance hints. CALL THIS BEFORE running any "
        "tool that touches external systems, PII, databases, or shell."
    )
    args_schema: Type[BaseModel] = _EvaluateSchema

    def __init__(self, shield: JakShieldClient, **data: Any) -> None:
        super().__init__(**data)
        self._shield = shield

    def _run(self, tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        return self._shield.evaluate(tool_name, args)


class JakShieldScanTool(BaseTool):
    name: str = "jak_shield_scan"
    description: str = (
        "Defense-in-depth scan of a string for PII (28 types with cryptographic "
        "validators), secrets, and prompt injection across 13 non-English "
        "languages and 6 detection stages."
    )
    args_schema: Type[BaseModel] = _ScanSchema

    def __init__(self, shield: JakShieldClient, **data: Any) -> None:
        super().__init__(**data)
        self._shield = shield

    def _run(self, text: str) -> Dict[str, Any]:
        return self._shield.scan(text)


class JakShieldRedactTool(BaseTool):
    name: str = "jak_shield_redact"
    description: str = (
        "Redact PII and secrets from a string or JSON object. Use BEFORE "
        "posting any potentially-sensitive payload to an external service."
    )
    args_schema: Type[BaseModel] = _RedactSchema

    def __init__(self, shield: JakShieldClient, **data: Any) -> None:
        super().__init__(**data)
        self._shield = shield

    def _run(
        self,
        text: Optional[str] = None,
        obj: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return self._shield.redact(text=text, obj=obj)


class JakShieldComplianceTool(BaseTool):
    name: str = "jak_shield_compliance_tag"
    description: str = (
        "Tag a planned tool call with regulatory hints (PCI / HIPAA / GDPR / "
        "CCPA / SOX / FERPA / DPDP). These are TRIAGE SIGNALS — not legal "
        "compliance determinations. Always surface the disclaimer."
    )
    args_schema: Type[BaseModel] = _ComplianceSchema

    def __init__(self, shield: JakShieldClient, **data: Any) -> None:
        super().__init__(**data)
        self._shield = shield

    def _run(self, tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        return self._shield.compliance_tag(tool_name, args)


def jak_shield_tools(shield: JakShieldClient) -> List[BaseTool]:
    """Return the canonical set of JAK Shield CrewAI tools."""
    return [
        JakShieldEvaluateTool(shield=shield),
        JakShieldScanTool(shield=shield),
        JakShieldRedactTool(shield=shield),
        JakShieldComplianceTool(shield=shield),
    ]


# -------------------- gate() decorator ----------------------------------------


class _GatedToolError(Exception):
    """Raised when JAK Shield blocks a gated tool call."""


def gate(tool: BaseTool, shield: JakShieldClient) -> BaseTool:
    """Wrap an existing CrewAI tool so every invocation passes through JAK
    Shield first. Block / requires_approval → raises _GatedToolError. Redact
    → invokes the inner tool with the redacted args.
    """

    original = tool
    inner_run = original._run  # type: ignore[attr-defined]

    class _Gated(type(original)):  # type: ignore[misc]
        name: str = original.name
        description: str = f"[JAK Shield-gated] {original.description}"
        args_schema: Type[BaseModel] = original.args_schema  # type: ignore[assignment]

        def _run(self, **kwargs: Any) -> Any:
            decision = shield.evaluate(original.name, kwargs).get("decision", {})
            action = decision.get("action")
            if action == "block":
                raise _GatedToolError(
                    f"JAK Shield blocked '{original.name}': {decision.get('reason')}. "
                    f"Safe alternative: {decision.get('safe_alternative')}"
                )
            if action == "requires_approval":
                raise _GatedToolError(
                    f"JAK Shield requires human approval "
                    f"(approval_id={decision.get('approval_id')}): "
                    f"{decision.get('reason')}"
                )
            effective = kwargs
            if action == "redact":
                effective = decision.get("provenance", {}).get("redactedArgs") or kwargs
            return inner_run(**effective)  # type: ignore[misc]

    return _Gated()


__all__ = [
    "JakShieldClient",
    "JakShieldEvaluateTool",
    "JakShieldScanTool",
    "JakShieldRedactTool",
    "JakShieldComplianceTool",
    "jak_shield_tools",
    "gate",
]
