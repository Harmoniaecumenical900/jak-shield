export class ShieldError extends Error {
  constructor(message: string, public readonly code: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'ShieldError';
  }
}

export class PolicyViolationError extends ShieldError {
  constructor(message: string, rule: string, details?: Record<string, unknown>) {
    super(message, 'POLICY_VIOLATION', { rule, ...details });
    this.name = 'PolicyViolationError';
  }
}

export class ApprovalRequiredError extends ShieldError {
  constructor(approvalId: string, reason: string) {
    super(reason, 'APPROVAL_REQUIRED', { approvalId });
    this.name = 'ApprovalRequiredError';
  }
}

export class ConnectorNotConfiguredError extends ShieldError {
  constructor(connector: string, missingEnv: string[]) {
    super(`Connector '${connector}' is not configured. Missing: ${missingEnv.join(', ')}`, 'CONNECTOR_NOT_CONFIGURED', {
      connector,
      missingEnv,
    });
    this.name = 'ConnectorNotConfiguredError';
  }
}

export class CredentialDecryptError extends ShieldError {
  constructor(connector: string) {
    super(`Failed to decrypt credentials for connector '${connector}'.`, 'CREDENTIAL_DECRYPT_FAILED', { connector });
    this.name = 'CredentialDecryptError';
  }
}
