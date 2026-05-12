import type { PolicyDecision, ToolCallContext, ToolMetadata, ToolExecutionResult } from '@jak-shield/shared';
import { ToolRiskClass } from '@jak-shield/shared';
import { sanitizeToolOutput } from '@jak-shield/prompt-shield';
import { recordTaint, recordSessionCall } from '@jak-shield/policy-engine';

export interface ConnectorTool {
  metadata: ToolMetadata;
  execute(args: Record<string, unknown>, context: ToolCallContext, decision: PolicyDecision): Promise<ToolExecutionResult>;
  /** Optional config check; throws ConnectorNotConfiguredError if missing env. */
  checkConfig?(): void;
}

const tools = new Map<string, ConnectorTool>();

export function registerConnectorTool(tool: ConnectorTool): void {
  tools.set(tool.metadata.name, tool);
}

export function getConnectorTool(name: string): ConnectorTool | null {
  return tools.get(name) ?? null;
}

export function listConnectorTools(): ToolMetadata[] {
  return [...tools.values()].map((t) => t.metadata);
}

export function clearConnectorRegistry(): void {
  tools.clear();
}

export function defineTool(
  name: string,
  description: string,
  riskClass: ToolRiskClass,
  inputSchema: Record<string, unknown>,
): ToolMetadata {
  return { name, description, riskClass, inputSchema };
}

export async function runConnectorWithSanitization(
  tool: ConnectorTool,
  args: Record<string, unknown>,
  context: ToolCallContext,
  decision: PolicyDecision,
): Promise<ToolExecutionResult> {
  const result = await tool.execute(args, context, decision);
  if (!result.success || typeof result.data !== 'string') return result;

  const source = tool.metadata.name.startsWith('browser.') || tool.metadata.name.startsWith('http.') ? 'browser' : 'tool';
  const sanitized = sanitizeToolOutput(result.data, source);
  const finalData = sanitized.injectionDetected ? sanitized.sanitized : result.data;

  // Record taint of the original (not-yet-sanitized) data so the policy engine
  // can detect if a future call reuses any of it as input to a sensitive sink.
  recordTaint(context.sessionId ?? context.requestId, tool.metadata.name, result.data);
  // Re-record session-call now with output so attack-chain detection can do
  // data-flow analysis (output of step N → args of step N+1).
  recordSessionCall(context.sessionId ?? context.requestId, tool.metadata.name, result.data);

  if (sanitized.injectionDetected) {
    return { ...result, data: finalData, injectionDetectedInOutput: true };
  }
  return result;
}
