"""
JAK Shield ↔ LangChain (Python) adapter.

Wraps the JAK Shield REST API as LangChain BaseTool instances so any
LangChain / LangGraph / CrewAI / AutoGen agent that consumes LangChain tools
can route its tool calls through JAK Shield's policy engine.

Usage:

    from langchain.agents import AgentExecutor, create_react_agent
    from jak_shield_langchain import jak_shield_tools, JakShieldClient

    shield = JakShieldClient(base_url="https://shield.example.com/api",
                             api_key="jks_...")

    # Option 1: Use the shield tools directly as your agent's toolset.
    tools = jak_shield_tools(shield)
    agent = create_react_agent(llm, tools, prompt)

    # Option 2: Gate your existing tool by wrapping it.
    safe_send = shield.gate(my_send_email_tool)

Requirements:
    pip install langchain-core pydantic httpx

License: MIT (same as JAK Shield itself)
"""

from __future__ import annotations

import os
from typing import Any, Callable, Dict, List, Optional

import httpx
from langchain_core.tools import BaseTool, ToolException
from pydantic import BaseModel, Field, ConfigDict


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
        self._client = httpx.Client(
            base_url=self.base_url,
            timeout=timeout_seconds,
            headers=self._headers(),
        )

    def _headers(self) -> Dict[str, str]:
        h = {"Content-Type": "application/json"}
        if self.api_key:
            h["Authorization"] = f"Bearer {self.api_key}"
        return h

    def evaluate(
        self,
        tool_name: str,
        args: Optional[Dict[str, Any]] = None,
        execute: bool = False,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """POST /api/evaluate — return the full decision JSON."""
        r = self._client.post(
            "/evaluate",
            json={"tool_name": tool_name, "args": args or {}, "execute": execute, "context": context},
        )
        r.raise_for_status()
        return r.json()

    def scan(self, text: str) -> Dict[str, Any]:
        r = self._client.post("/evaluate/scan", json={"text": text})
        r.raise_for_status()
        return r.json()

    def redact(
        self,
        text: Optional[str] = None,
        obj: Optional[Dict[str, Any]] = None,
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

    def list_tools(self) -> List[Dict[str, Any]]:
        r = self._client.get("/connectors/tools")
        r.raise_for_status()
        return r.json()

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "JakShieldClient":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    # ------------------ Gate decorator ------------------------------------

    def gate(self, tool: BaseTool) -> BaseTool:
        """Wrap an existing LangChain BaseTool so every invocation passes
        through JAK Shield first. If the decision is `block`, raises
        ToolException. If `requires_approval`, raises with the approval_id.
        If `redact`, the tool is invoked with the redacted args.
        """
        original = tool

        class _GatedTool(BaseTool):
            name: str = original.name
            description: str = (
                f"[JAK Shield-gated] {original.description}"
            )
            args_schema = original.args_schema  # type: ignore[assignment]
            shield: JakShieldClient = Field(exclude=True)
            inner: BaseTool = Field(exclude=True)
            model_config = ConfigDict(arbitrary_types_allowed=True)

            def _run(self, **kwargs: Any) -> Any:
                decision = self.shield.evaluate(self.inner.name, kwargs)
                action = decision.get("action")
                if action == "block":
                    raise ToolException(
                        f"JAK Shield blocked '{self.inner.name}': {decision.get('reason')}. "
                        f"Safe alternative: {decision.get('safe_alternative')}"
                    )
                if action == "requires_approval":
                    raise ToolException(
                        f"JAK Shield requires human approval (approval_id={decision.get('approval_id')}): "
                        f"{decision.get('reason')}"
                    )
                effective_args = kwargs
                if action == "redact":
                    redacted = decision.get("provenance", {}).get("redactedArgs") or kwargs
                    effective_args = redacted
                return self.inner.invoke(effective_args)

            async def _arun(self, **kwargs: Any) -> Any:
                return self._run(**kwargs)

        return _GatedTool(shield=self, inner=original)


# -------------------- Standalone LangChain tools ------------------------------

class _EvaluateInput(BaseModel):
    tool_name: str = Field(description="MCP tool name to evaluate (e.g. gmail.send_email)")
    args: Dict[str, Any] = Field(default_factory=dict, description="Args the agent intends to pass")


class _ScanInput(BaseModel):
    text: str = Field(description="Text to scan for PII / secrets / prompt injection")


class _RedactInput(BaseModel):
    text: Optional[str] = Field(default=None)
    obj: Optional[Dict[str, Any]] = Field(default=None)


class _ComplianceInput(BaseModel):
    tool_name: str
    args: Dict[str, Any] = Field(default_factory=dict)


class JakShieldEvaluateTool(BaseTool):
    name: str = "jak_shield_evaluate"
    description: str = (
        "Evaluate a planned tool call against JAK Shield. Returns a decision "
        "with action (allow/block/requires_approval/redact/rewrite), risk, "
        "reason, evidence tree, and compliance tags. CALL THIS BEFORE running "
        "any tool that touches external systems, PII, databases, or shell."
    )
    args_schema: type = _EvaluateInput
    shield: JakShieldClient = Field(exclude=True)
    model_config = ConfigDict(arbitrary_types_allowed=True)

    def _run(self, tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        return self.shield.evaluate(tool_name, args)


class JakShieldScanTool(BaseTool):
    name: str = "jak_shield_scan"
    description: str = (
        "Defense-in-depth scan of a string for PII (28 types with cryptographic "
        "validators), secrets, and prompt-injection across 13 languages + 6 "
        "detection stages. Returns evidence tree, redacted text, and findings."
    )
    args_schema: type = _ScanInput
    shield: JakShieldClient = Field(exclude=True)
    model_config = ConfigDict(arbitrary_types_allowed=True)

    def _run(self, text: str) -> Dict[str, Any]:
        return self.shield.scan(text)


class JakShieldRedactTool(BaseTool):
    name: str = "jak_shield_redact"
    description: str = (
        "Redact PII and secrets from a string or JSON object. Use BEFORE "
        "posting any potentially-sensitive payload to an external service."
    )
    args_schema: type = _RedactInput
    shield: JakShieldClient = Field(exclude=True)
    model_config = ConfigDict(arbitrary_types_allowed=True)

    def _run(self, text: Optional[str] = None, obj: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return self.shield.redact(text=text, obj=obj)


class JakShieldComplianceTool(BaseTool):
    name: str = "jak_shield_compliance_tag"
    description: str = (
        "Tag a planned tool call with regulatory hints (PCI/HIPAA/GDPR/SOX/"
        "FERPA/DPDP/CCPA). These are TRIAGE SIGNALS — not legal compliance "
        "determinations. Always show the returned disclaimer to the user."
    )
    args_schema: type = _ComplianceInput
    shield: JakShieldClient = Field(exclude=True)
    model_config = ConfigDict(arbitrary_types_allowed=True)

    def _run(self, tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        return self.shield.compliance_tag(tool_name, args)


def jak_shield_tools(shield: JakShieldClient) -> List[BaseTool]:
    """Return the canonical set of JAK Shield tools as LangChain BaseTools."""
    return [
        JakShieldEvaluateTool(shield=shield),
        JakShieldScanTool(shield=shield),
        JakShieldRedactTool(shield=shield),
        JakShieldComplianceTool(shield=shield),
    ]


__all__ = [
    "JakShieldClient",
    "JakShieldEvaluateTool",
    "JakShieldScanTool",
    "JakShieldRedactTool",
    "JakShieldComplianceTool",
    "jak_shield_tools",
]
