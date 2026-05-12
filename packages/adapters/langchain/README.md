# JAK Shield → LangChain adapter

LangChain users can route every tool invocation through JAK Shield with one line of code.

Two flavors, same interface:

| Flavor | Location | Install |
|---|---|---|
| Python | [`./python`](./python) | `pip install -e ./python` *(or copy `jak_shield_langchain.py` into your project)* |
| TypeScript / JS | [`./js`](./js) | `pnpm install` in `./js` then `pnpm build` *(npm package coming)* |

## What you get

Both flavors export the same four LangChain tools:

- **`jak_shield_evaluate`** — decide if a planned tool call is safe (allow / block / requires_approval / redact / rewrite)
- **`jak_shield_scan`** — defense-in-depth scan for PII / secrets / prompt-injection
- **`jak_shield_redact`** — strip PII from a string or JSON object
- **`jak_shield_compliance_tag`** — regulatory hints (PCI / HIPAA / GDPR / SOX / FERPA / DPDP)

Plus a **`gate(tool)`** wrapper that turns any existing LangChain tool into a JAK-Shield-gated version: every invocation evaluates first, blocks throw, redactions substitute args.

## Quick start (Python)

```python
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_openai import ChatOpenAI
from jak_shield_langchain import JakShieldClient, jak_shield_tools

shield = JakShieldClient(base_url="https://shield.example.com/api", api_key="jks_…")
tools = jak_shield_tools(shield)

agent = create_openai_tools_agent(ChatOpenAI(model="gpt-4o-mini"), tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools)
executor.invoke({"input": "Should I send the customer SSN list to partner@external.com?"})
# Agent now uses jak_shield_evaluate to check before any send action.
```

Or wrap an existing tool:

```python
from my_tools import send_email_tool

safe_send = shield.gate(send_email_tool)
agent = create_openai_tools_agent(llm, [safe_send, other_tools...], prompt)
# safe_send raises ToolException if JAK Shield blocks the call.
```

## Quick start (TypeScript)

```ts
import { JakShieldClient, jakShieldTools, gate } from '@jak-shield/langchain';
import { createReactAgent } from '@langchain/langgraph/prebuilt';

const shield = new JakShieldClient({ baseUrl: 'https://shield.example.com/api', apiKey: 'jks_…' });
const tools = jakShieldTools(shield);

const agent = createReactAgent({ llm, tools });

// Or gate an existing tool:
const safeSend = gate(mySendEmailTool, shield);
```

## Recommended agent instructions

Add this to your agent's system prompt so it uses JAK Shield consistently:

> Before executing any tool that sends data externally, queries a database,
> runs a shell command, or processes user PII, FIRST call `jak_shield_evaluate`
> with the planned `tool_name` and `args`. If the response action is `block`
> or `requires_approval`, STOP and explain the decision plus the
> `safe_alternative` to the user. If `redact`, use the redacted args returned
> in the response. Always show the user the `compliance` tags if present.

## What this is NOT

- This adapter does NOT replicate JAK Shield's full MCP surface (20 `shield.*` tools + 24 connectors). It exposes the four most-useful operations for LangChain agents. For the full surface, run your agent through an MCP-native client (Cursor / Claude Desktop / OpenAI Agents SDK).
- The `gate()` wrapper does not enforce capability tokens. If your environment requires single-use cryptographic authorization per tool call, see `shield.issue_capability_token` via the MCP surface.

License: MIT.
