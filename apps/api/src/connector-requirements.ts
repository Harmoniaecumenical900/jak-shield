/**
 * Static map of connector → env vars it expects. Drives the connector setup UI.
 * Keep this in sync with each connector's `getConfig()` / `token()` function.
 */

export interface ConnectorRequirement {
  connector: string;
  displayName: string;
  description: string;
  required: { name: string; description: string; sensitive: boolean }[];
  optional?: { name: string; description: string; sensitive: boolean }[];
  docsUrl?: string;
}

export const CONNECTOR_REQUIREMENTS: ConnectorRequirement[] = [
  {
    connector: 'gmail',
    displayName: 'Gmail',
    description: 'Send and read email via Gmail (OAuth2 refresh-token flow).',
    required: [
      { name: 'GMAIL_CLIENT_ID', description: 'Google OAuth client id', sensitive: false },
      { name: 'GMAIL_CLIENT_SECRET', description: 'Google OAuth client secret', sensitive: true },
      { name: 'GMAIL_REFRESH_TOKEN', description: 'Long-lived refresh token', sensitive: true },
    ],
    docsUrl: 'https://developers.google.com/identity/protocols/oauth2',
  },
  {
    connector: 'github',
    displayName: 'GitHub',
    description: 'Create issues / PR comments / list repos via the GitHub REST API.',
    required: [
      { name: 'GITHUB_TOKEN', description: 'Personal access token or fine-grained PAT', sensitive: true },
    ],
    docsUrl: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens',
  },
  {
    connector: 'supabase',
    displayName: 'Supabase',
    description: 'Query a Supabase project via PostgREST + the execute_sql RPC.',
    required: [
      { name: 'SUPABASE_URL', description: 'https://<project>.supabase.co', sensitive: false },
      { name: 'SUPABASE_SERVICE_KEY', description: 'service_role key', sensitive: true },
    ],
  },
  {
    connector: 'postgres',
    displayName: 'Postgres',
    description: 'Direct Postgres queries through the pg pool.',
    required: [
      { name: 'PG_QUERY_URL', description: 'postgresql://user:pass@host/db', sensitive: true },
    ],
  },
  {
    connector: 'slack',
    displayName: 'Slack',
    description: 'Post messages with chat.postMessage.',
    required: [{ name: 'SLACK_BOT_TOKEN', description: 'xoxb-… bot token', sensitive: true }],
  },
  {
    connector: 'sms',
    displayName: 'SMS (Twilio)',
    description: 'Send SMS via Twilio.',
    required: [
      { name: 'TWILIO_ACCOUNT_SID', description: 'Twilio Account SID', sensitive: false },
      { name: 'TWILIO_AUTH_TOKEN', description: 'Twilio Auth Token', sensitive: true },
      { name: 'TWILIO_FROM_NUMBER', description: 'E.164 sender number', sensitive: false },
    ],
  },
  {
    connector: 'gdrive',
    displayName: 'Google Drive',
    description: 'List files via Drive REST API (shares OAuth client with Gmail).',
    required: [
      { name: 'GMAIL_CLIENT_ID', description: 'Google OAuth client id', sensitive: false },
      { name: 'GMAIL_CLIENT_SECRET', description: 'Google OAuth client secret', sensitive: true },
      { name: 'GDRIVE_REFRESH_TOKEN', description: 'Drive refresh token (Drive scope)', sensitive: true },
    ],
  },
  {
    connector: 'filesystem',
    displayName: 'Filesystem (sandboxed)',
    description: 'Read/write inside the JAK Shield sandbox root.',
    required: [],
    optional: [
      { name: 'SHIELD_FS_SANDBOX_ROOT', description: 'Absolute path; default ./.shield-sandbox', sensitive: false },
    ],
  },
  {
    connector: 'shell',
    displayName: 'Shell (allowlist-gated)',
    description: 'Run a small allowlist of shell programs as argv (no metacharacters).',
    required: [],
    optional: [
      { name: 'SHIELD_SHELL_ALLOWLIST', description: 'Comma-separated allowlist; default: echo,ls,cat,…', sensitive: false },
    ],
  },
  {
    connector: 'browser',
    displayName: 'Browser fetch',
    description: 'Fetch URLs (output scanned for prompt injection).',
    required: [],
    optional: [
      { name: 'SHIELD_BROWSER_DENYLIST', description: 'Comma-separated host denylist', sensitive: false },
    ],
  },
  {
    connector: 'http',
    displayName: 'HTTP fetch / POST',
    description: 'Generic HTTP GET (read-only) and POST (external side effect).',
    required: [],
  },
  {
    connector: 'webhook',
    displayName: 'Outgoing webhook',
    description: 'POST a JSON payload to any URL.',
    required: [],
  },
  {
    connector: 'social',
    displayName: 'Social (drafts + publish-with-approval)',
    description: 'Save social drafts; publishing always requires approval.',
    required: [],
  },
];
