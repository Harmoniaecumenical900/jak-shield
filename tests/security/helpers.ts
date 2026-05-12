import { UserRole } from '@jak-shield/shared';
import type { ToolCallContext, ToolCallRequest } from '@jak-shield/shared';
import { newRequestId } from '@jak-shield/core';

export function ctx(role = UserRole.TENANT_ADMIN, tenantId = 'test-tenant'): ToolCallContext {
  return {
    tenantId,
    userId: 'test-user',
    role,
    requestId: newRequestId(),
    timestamp: new Date().toISOString(),
  };
}

export function req(toolName: string, args: Record<string, unknown>, role?: UserRole): ToolCallRequest {
  return { toolName, args, context: ctx(role) };
}
