# JAK Shield → Pydantic AI adapter

Native Pydantic AI integration. Register four Shield tools onto any Agent in one call, or `gate()` your existing async tool functions.

## Install

```bash
pip install -e packages/adapters/pydantic-ai
# or copy jak_shield_pydantic_ai.py into your project
```

## Quick start

```python
from pydantic_ai import Agent
from jak_shield_pydantic_ai import JakShieldClient, register_jak_shield_tools

shield = JakShieldClient(
    base_url="https://shield.example.com/api",
    api_key="jks_…",
)

agent = Agent(
    'openai:gpt-4o-mini',
    system_prompt=(
        "Before calling any tool that sends data externally, queries a "
        "database, runs shell, or processes PII, FIRST call "
        "jak_shield_evaluate with the planned tool_name and args. If the "
        "decision is block or requires_approval, STOP and explain. If "
        "redact, use the redacted args. Always show compliance tags + the "
        "disclaimer to the user."
    ),
)

register_jak_shield_tools(agent, shield)

result = await agent.run(
    "Should I send a customer list including SSN 123-45-6789 to partner@external.com?"
)
print(result.data)
```

The Agent now has four extra tools available at every step: `jak_shield_evaluate`, `jak_shield_scan`, `jak_shield_redact`, `jak_shield_compliance_tag`.

## Gate one of your own async tools

```python
from pydantic_ai import Agent
from jak_shield_pydantic_ai import JakShieldClient, gate, JakShieldBlocked

shield = JakShieldClient(base_url=..., api_key=...)
agent = Agent('openai:gpt-4o-mini')

@agent.tool_plain
async def send_email(to: str, subject: str, body: str) -> str:
    return await my_gmail.send(to=to, subject=subject, body=body)

# Replace with gated version:
@agent.tool_plain
async def send_email_gated(to: str, subject: str, body: str) -> str:
    return await gate(send_email, shield, "send_email")(to=to, subject=subject, body=body)
```

When JAK Shield blocks: `JakShieldBlocked` is raised. When approval is required: `JakShieldApprovalRequired` (carries the `approval_id`).

## Note on async

Pydantic AI agents prefer async tools. The HTTP client used here is `httpx.AsyncClient`. Close it when you're done:

```python
await shield.aclose()
```

License: MIT.
