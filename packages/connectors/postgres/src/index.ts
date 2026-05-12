import { Pool } from 'pg';
import { ToolRiskClass } from '@jak-shield/shared';
import type { ToolExecutionResult } from '@jak-shield/shared';
import { ConnectorNotConfiguredError } from '@jak-shield/core';
import { defineTool, registerConnectorTool, type ConnectorTool } from '@jak-shield/connectors-registry';

let pool: Pool | null = null;
function getPool(): Pool {
  if (pool) return pool;
  const url = process.env.PG_QUERY_URL ?? process.env.DATABASE_URL;
  if (!url) throw new ConnectorNotConfiguredError('postgres', ['PG_QUERY_URL or DATABASE_URL']);
  pool = new Pool({ connectionString: url, max: 5 });
  return pool;
}

const queryTool: ConnectorTool = {
  metadata: defineTool('postgres.query', 'Run a parameterized SQL query against Postgres', ToolRiskClass.WRITE, {
    type: 'object',
    properties: {
      sql: { type: 'string' },
      params: { type: 'array' },
    },
    required: ['sql'],
  }),
  async execute(args): Promise<ToolExecutionResult> {
    try {
      const sql = String(args['sql'] ?? '');
      const params = Array.isArray(args['params']) ? (args['params'] as unknown[]) : [];
      const r = await getPool().query(sql, params);
      return { success: true, data: JSON.stringify({ rowCount: r.rowCount, rows: r.rows }) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

export function registerPostgresConnector(): void {
  registerConnectorTool(queryTool);
}
