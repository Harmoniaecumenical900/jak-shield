import { RiskLevel, UserRole } from '@jak-shield/shared';

export const Permissions = {
  TOOL_EXECUTE_READ: 'tool:execute:read',
  TOOL_EXECUTE_WRITE: 'tool:execute:write',
  TOOL_EXECUTE_DESTRUCTIVE: 'tool:execute:destructive',
  APPROVAL_VIEW: 'approval:view',
  APPROVAL_DECIDE: 'approval:decide',
  AUDIT_VIEW: 'audit:view',
  AUDIT_VIEW_ALL: 'audit:view:all',
  POLICY_VIEW: 'policy:view',
  POLICY_EDIT: 'policy:edit',
  CONNECTOR_VIEW: 'connector:view',
  CONNECTOR_MANAGE: 'connector:manage',
  ADMIN_CONSOLE: 'admin:console',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

export const ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
  [UserRole.EXTERNAL_AUDITOR]: new Set<Permission>([Permissions.AUDIT_VIEW]),
  [UserRole.END_USER]: new Set<Permission>([
    Permissions.TOOL_EXECUTE_READ,
    Permissions.APPROVAL_VIEW,
  ]),
  [UserRole.REVIEWER]: new Set<Permission>([
    Permissions.TOOL_EXECUTE_READ,
    Permissions.APPROVAL_VIEW,
    Permissions.APPROVAL_DECIDE,
    Permissions.AUDIT_VIEW,
  ]),
  [UserRole.OPERATOR]: new Set<Permission>([
    Permissions.TOOL_EXECUTE_READ,
    Permissions.TOOL_EXECUTE_WRITE,
    Permissions.APPROVAL_VIEW,
    Permissions.APPROVAL_DECIDE,
    Permissions.AUDIT_VIEW,
    Permissions.AUDIT_VIEW_ALL,
    Permissions.POLICY_VIEW,
    Permissions.CONNECTOR_VIEW,
  ]),
  [UserRole.TENANT_ADMIN]: new Set<Permission>([
    Permissions.TOOL_EXECUTE_READ,
    Permissions.TOOL_EXECUTE_WRITE,
    Permissions.TOOL_EXECUTE_DESTRUCTIVE,
    Permissions.APPROVAL_VIEW,
    Permissions.APPROVAL_DECIDE,
    Permissions.AUDIT_VIEW,
    Permissions.AUDIT_VIEW_ALL,
    Permissions.POLICY_VIEW,
    Permissions.POLICY_EDIT,
    Permissions.CONNECTOR_VIEW,
    Permissions.CONNECTOR_MANAGE,
    Permissions.ADMIN_CONSOLE,
  ]),
};

export const RISK_APPROVAL_ROLE: Record<RiskLevel, UserRole> = {
  [RiskLevel.LOW]: UserRole.END_USER,
  [RiskLevel.MEDIUM]: UserRole.REVIEWER,
  [RiskLevel.HIGH]: UserRole.OPERATOR,
  [RiskLevel.CRITICAL]: UserRole.TENANT_ADMIN,
};
