import { ToolRiskClass } from '@jak-shield/shared';
import type { ToolExecutionResult } from '@jak-shield/shared';
import { ConnectorNotConfiguredError } from '@jak-shield/core';
import { defineTool, registerConnectorTool, type ConnectorTool } from '@jak-shield/connectors-registry';

const API = 'https://api.github.com';

function token(): string {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new ConnectorNotConfiguredError('github', ['GITHUB_TOKEN']);
  return t;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${token()}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'jak-shield',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

const createIssue: ConnectorTool = {
  metadata: defineTool('github.create_issue', 'Open a new issue on a GitHub repository', ToolRiskClass.EXTERNAL_SIDE_EFFECT, {
    type: 'object',
    properties: {
      owner: { type: 'string' },
      repo: { type: 'string' },
      title: { type: 'string' },
      body: { type: 'string' },
      labels: { type: 'array', items: { type: 'string' } },
    },
    required: ['owner', 'repo', 'title'],
  }),
  async execute(args): Promise<ToolExecutionResult> {
    try {
      const { owner, repo } = args as { owner: string; repo: string };
      const res = await fetch(`${API}/repos/${owner}/${repo}/issues`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: args['title'], body: args['body'], labels: args['labels'] }),
      });
      if (!res.ok) return { success: false, error: `GitHub create_issue failed: ${res.status} ${await res.text()}` };
      const j = (await res.json()) as { html_url?: string; number?: number };
      return { success: true, data: `Issue #${j.number}: ${j.html_url}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

const createPrComment: ConnectorTool = {
  metadata: defineTool('github.create_pr_comment', 'Comment on a pull request', ToolRiskClass.EXTERNAL_SIDE_EFFECT, {
    type: 'object',
    properties: {
      owner: { type: 'string' },
      repo: { type: 'string' },
      pull_number: { type: 'number' },
      body: { type: 'string' },
    },
    required: ['owner', 'repo', 'pull_number', 'body'],
  }),
  async execute(args): Promise<ToolExecutionResult> {
    try {
      const { owner, repo, pull_number } = args as { owner: string; repo: string; pull_number: number };
      const res = await fetch(`${API}/repos/${owner}/${repo}/issues/${pull_number}/comments`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: args['body'] }),
      });
      if (!res.ok) return { success: false, error: `GitHub comment failed: ${res.status}` };
      return { success: true, data: `Comment posted on PR #${pull_number}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

const listRepos: ConnectorTool = {
  metadata: defineTool('github.list_repos', 'List repos accessible to the configured token', ToolRiskClass.READ_ONLY, {
    type: 'object',
    properties: { per_page: { type: 'number', default: 30 } },
  }),
  async execute(args): Promise<ToolExecutionResult> {
    try {
      const res = await fetch(`${API}/user/repos?per_page=${Number(args['per_page'] ?? 30)}`, { headers: headers() });
      if (!res.ok) return { success: false, error: `GitHub list_repos failed: ${res.status}` };
      return { success: true, data: JSON.stringify(await res.json()) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export function registerGithubConnector(): void {
  registerConnectorTool(createIssue);
  registerConnectorTool(createPrComment);
  registerConnectorTool(listRepos);
}
