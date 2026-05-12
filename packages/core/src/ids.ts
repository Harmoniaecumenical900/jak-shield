import { randomBytes } from 'node:crypto';

export function newRequestId(): string {
  return `req_${randomBytes(8).toString('hex')}`;
}

export function newApprovalId(): string {
  return `apr_${randomBytes(8).toString('hex')}`;
}

export function newAuditId(): string {
  return `aud_${randomBytes(8).toString('hex')}`;
}
