import { AsyncLocalStorage } from 'node:async_hooks';
import type { UserRole } from '@jak-shield/shared';

export interface TenantContext {
  tenantId: string;
  userId?: string;
  role: UserRole;
  apiKeyId?: string;
}

const storage = new AsyncLocalStorage<TenantContext>();

/** Imperative setter — used by HTTP transport before invoking the MCP server. */
export function setTenantContext(ctx: TenantContext): void {
  storage.enterWith(ctx);
}

export function clearTenantContext(): void {
  // Replace the current store with an empty marker; getStore() in any later
  // turn will see it and the consumer treats `undefined.tenantId` as no tenant.
  storage.enterWith(undefined as unknown as TenantContext);
}

export function getTenantContext(): TenantContext | undefined {
  const store = storage.getStore();
  return store && store.tenantId ? store : undefined;
}

export function withTenantContext<T>(ctx: TenantContext, fn: () => Promise<T> | T): Promise<T> | T {
  return storage.run(ctx, fn);
}
