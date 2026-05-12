# JAK Shield → ChatGPT Custom GPTs / Actions

Use [`jak-shield-actions.yaml`](./jak-shield-actions.yaml) to integrate JAK Shield as a tool inside any ChatGPT Custom GPT.

## What this gives your GPT

Five action operations:

| Operation | Use it for |
|---|---|
| `evaluateToolCall` | Before the GPT calls any external system, ask: is this safe? |
| `scanText` | Defense-in-depth scan of any user input or document the GPT is about to summarize |
| `redactSensitiveData` | Strip PII before posting to a third-party service |
| `complianceTag` | "Is this action subject to HIPAA / GDPR / PCI?" — hints + citations |
| `listProtectedTools` | Discover what JAK Shield is gating |
| `listApprovals` | Show pending human-approval items |

## 4-step setup

1. **Deploy JAK Shield** somewhere with a public HTTPS URL. Easiest paths:
   - `docker-compose up -d` then put it behind a Cloudflare Tunnel for a free URL
   - Push to Railway / Render / Fly (Docker config in repo root)

2. **Create an API key** in your JAK Shield dashboard. Note the `jks_...` value (shown once).

3. **In ChatGPT** → "Create a GPT" → "Configure" → "Actions" → "Import from URL" or "Paste schema".

4. Open `jak-shield-actions.yaml`, replace `https://YOUR_HOST/api` with your real URL, paste the whole file into the Actions editor.
   Under "Authentication" pick **API Key → Bearer** and paste the `jks_...` value.

## Example GPT instructions

In your Custom GPT's "Instructions" field, add:

> Before executing any tool that sends data externally, contains user PII,
> or modifies a database, first call the `evaluateToolCall` action with the
> planned `tool_name` and `args`. If the response action is `block` or
> `requires_approval`, stop and explain the decision + the `safe_alternative`
> to the user. If the action is `redact`, use the `redacted` args returned in
> the response. Always show the user the `compliance` tags if any are present.

That single instruction turns any GPT into a JAK-Shield-gated agent.

## What the GPT cannot do via Actions

ChatGPT Actions can only call HTTP endpoints. They cannot:

- Run arbitrary MCP stdio servers (use Claude Desktop for that)
- Wire up multiple servers via the MCP protocol
- Surface real-time approval notifications

For the full MCP experience, use Claude Desktop / Cursor / OpenAI Agents SDK instead.
