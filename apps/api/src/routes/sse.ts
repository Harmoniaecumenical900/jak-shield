import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import type { ApprovalRecord } from '@jak-shield/shared';

interface ApprovalEvent {
  type: 'created' | 'decided';
  approval: ApprovalRecord;
}

const subscribers = new Set<FastifyReply>();

export function broadcastApprovalEvent(event: ApprovalEvent): void {
  const payload = `event: approval\ndata: ${JSON.stringify(event)}\n\n`;
  for (const reply of subscribers) {
    try {
      reply.raw.write(payload);
    } catch {
      subscribers.delete(reply);
    }
  }
}

export const sseRoutes: FastifyPluginAsync = async (app) => {
  app.get('/approvals', (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    subscribers.add(reply);
    req.raw.on('close', () => {
      subscribers.delete(reply);
    });
  });
};
