import { PrismaClient } from '@prisma/client';
import type { ApprovalQueue } from './queue.js';
import { InMemoryApprovalQueue } from './memory-queue.js';
import { PrismaApprovalQueue } from './prisma-queue.js';
import { createLogger } from '@jak-shield/shared';

const log = createLogger('approval-gateway:client');

let prisma: PrismaClient | null = null;
export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.LOG_LEVEL === 'debug' ? ['warn', 'error'] : ['error'],
    });
  }
  return prisma;
}

let queueInstance: ApprovalQueue | null = null;

/**
 * Returns the configured approval queue.
 * Uses Prisma if DATABASE_URL is set, otherwise falls back to in-memory.
 */
export function getApprovalQueue(): ApprovalQueue {
  if (queueInstance) return queueInstance;
  if (process.env.DATABASE_URL) {
    log.info('Using PrismaApprovalQueue (DATABASE_URL configured)');
    queueInstance = new PrismaApprovalQueue();
  } else {
    log.info('Using InMemoryApprovalQueue (no DATABASE_URL set — non-persistent)');
    queueInstance = new InMemoryApprovalQueue();
  }
  return queueInstance;
}

export function setApprovalQueue(q: ApprovalQueue): void {
  queueInstance = q;
}
