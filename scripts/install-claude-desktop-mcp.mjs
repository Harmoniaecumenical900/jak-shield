// Merge the JAK Shield MCP stdio entry into Claude Desktop's config without
// touching unrelated keys. Backs up the original first.
import { copyFileSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const APPDATA = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
const CFG_DIR = path.join(APPDATA, 'Claude');
const CFG_PATH = path.join(CFG_DIR, 'claude_desktop_config.json');
const STDIO_ENTRY = path.resolve(process.cwd(), 'packages', 'mcp-server', 'dist', 'stdio.js');

if (!existsSync(STDIO_ENTRY)) {
  console.error(`stdio entry missing: ${STDIO_ENTRY}\nRun \`pnpm build\` first.`);
  process.exit(1);
}

if (!existsSync(CFG_DIR)) mkdirSync(CFG_DIR, { recursive: true });

let cfg = {};
if (existsSync(CFG_PATH)) {
  const raw = readFileSync(CFG_PATH, 'utf8');
  try {
    cfg = JSON.parse(raw);
  } catch (e) {
    console.error(`Existing config is not valid JSON: ${e.message}`);
    process.exit(1);
  }
  const backup = `${CFG_PATH}.backup-${Date.now()}`;
  copyFileSync(CFG_PATH, backup);
  console.log(`Backed up existing config → ${backup}`);
}

cfg.mcpServers = {
  ...(cfg.mcpServers ?? {}),
  'jak-shield': {
    command: 'node',
    args: [STDIO_ENTRY],
    env: {
      SHIELD_AUTH_OPTIONAL: '1',
      SHIELD_DEFAULT_TENANT_ID: 'claude-desktop',
      SHIELD_DEFAULT_USER_ID: 'claude-desktop-user',
      SHIELD_DEFAULT_USER_ROLE: 'TENANT_ADMIN',
      SHIELD_CORPORATE_DOMAINS: 'jakshield.ai',
      LOG_LEVEL: 'info',
      // Optional — uncomment & set to enable the AI risk classifier:
      // OPENAI_API_KEY: '',
      // OPENAI_MODEL: 'gpt-5.4',
    },
  },
};

writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
console.log(`\nWrote ${CFG_PATH}`);
console.log(`MCP entry: jak-shield → node "${STDIO_ENTRY}"`);
console.log('\nNext: fully quit Claude Desktop (right-click tray icon → Quit), then reopen it.');
console.log('In a new chat, type:  "What MCP tools do you have from jak-shield?"');
