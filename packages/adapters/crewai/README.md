# JAK Shield → CrewAI adapter

Native CrewAI `BaseTool` integration. Drop the four JAK Shield tools onto any Agent, or use `gate()` to wrap one of your existing CrewAI tools.

## Install

```bash
pip install -e packages/adapters/crewai
# or copy jak_shield_crewai.py into your project
```

## Quick start

```python
from crewai import Agent, Crew, Task
from jak_shield_crewai import JakShieldClient, jak_shield_tools

shield = JakShieldClient(
    base_url="https://shield.example.com/api",
    api_key="jks_…",
)

risk_analyst = Agent(
    role="Risk Analyst",
    goal="Block any outbound action containing customer PII without redaction",
    backstory="You are the last line of defense before data leaves the org.",
    tools=jak_shield_tools(shield),
    allow_delegation=False,
)

review_task = Task(
    description="Decide if sending the quarterly metrics email to "
                "partner@external.com with body '{body}' is safe.",
    expected_output="A JSON decision from jak_shield_evaluate.",
    agent=risk_analyst,
)

Crew(agents=[risk_analyst], tasks=[review_task]).kickoff(
    inputs={"body": "SSN 123-45-6789 belongs to customer #42"}
)
```

## Gate an existing CrewAI tool

```python
from crewai_tools import EmailSenderTool
from jak_shield_crewai import gate

safe_send = gate(EmailSenderTool(), shield)
# safe_send is a drop-in replacement; it raises _GatedToolError on block/approval.
```

## Recommended agent backstory

> Before invoking any tool that sends data externally, queries a database,
> runs shell commands, or processes user PII, FIRST call `jak_shield_evaluate`
> with the planned tool name and args. If the decision is `block` or
> `requires_approval`, STOP and explain. If `redact`, use the redacted args.
> Always surface compliance tags + the disclaimer to the end user.

## What this is NOT

- Not the full MCP surface — the four exposed operations cover the high-value path. For full coverage, run CrewAI behind an MCP-native host (Claude Desktop / OpenAI Agents SDK / Cursor).
- `gate()` does not enforce capability tokens (issue them via the MCP `shield.issue_capability_token` if your environment requires single-use cryptographic authorization).

License: MIT.
