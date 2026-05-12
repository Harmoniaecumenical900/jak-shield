import { RiskLevel, UserRole } from '@jak-shield/shared';
import { Permissions, ROLE_PERMISSIONS, RISK_APPROVAL_ROLE } from './roles.js';
import type { Permission } from './roles.js';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.EXTERNAL_AUDITOR]: 0,
  [UserRole.END_USER]: 1,
  [UserRole.REVIEWER]: 2,
  [UserRole.OPERATOR]: 3,
  [UserRole.TENANT_ADMIN]: 4,
};

export class PolicyEngine {
  checkPermission(role: UserRole, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role].has(permission);
  }

  checkAction(role: UserRole, action: string, resource: string): boolean {
    const permissionKey = `${resource}:${action}` as Permission;
    if (ROLE_PERMISSIONS[role].has(permissionKey)) return true;
    for (const perm of ROLE_PERMISSIONS[role]) {
      if (perm.startsWith(`${resource}:${action}`)) return true;
    }
    return false;
  }

  canApproveRiskLevel(role: UserRole, riskLevel: RiskLevel): boolean {
    const requiredRole = RISK_APPROVAL_ROLE[riskLevel];
    return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[requiredRole];
  }

  canExecuteTool(role: UserRole, toolRiskClass: 'READ_ONLY' | 'WRITE' | 'DESTRUCTIVE' | 'EXTERNAL_SIDE_EFFECT'): boolean {
    switch (toolRiskClass) {
      case 'READ_ONLY':
        return this.checkPermission(role, Permissions.TOOL_EXECUTE_READ);
      case 'WRITE':
        return this.checkPermission(role, Permissions.TOOL_EXECUTE_WRITE);
      case 'DESTRUCTIVE':
      case 'EXTERNAL_SIDE_EFFECT':
        return this.checkPermission(role, Permissions.TOOL_EXECUTE_DESTRUCTIVE);
    }
  }

  roleAtLeast(roleA: UserRole, roleB: UserRole): boolean {
    return ROLE_HIERARCHY[roleA] >= ROLE_HIERARCHY[roleB];
  }

  getPermissions(role: UserRole): Permission[] {
    return [...ROLE_PERMISSIONS[role]];
  }
}

export const policyEngine = new PolicyEngine();
