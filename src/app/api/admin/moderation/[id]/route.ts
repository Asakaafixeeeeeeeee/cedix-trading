import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

/** Resolve a moderation event: approve (restore content) or uphold removal. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const { decision } = await req.json(); // 'approve' | 'remove' | 'block'
    const event = await prisma.moderationEvent.findUnique({ where: { id } });
    if (!event) throw new Error('Event not found');

    await prisma.$transaction(async (db) => {
      if (event.targetType === 'POST') {
        await db.orbitPost.update({
          where: { id: event.targetId },
          data: { status: decision === 'approve' ? 'ACTIVE' : 'REMOVED' },
        });
      } else if (event.targetType === 'COMMENT') {
        await db.orbitComment.update({
          where: { id: event.targetId },
          data: { status: decision === 'approve' ? 'ACTIVE' : 'REMOVED' },
        });
      }
      if (decision === 'block') {
        await db.user.update({ where: { id: event.userId }, data: { orbitBanned: true } });
      }
      if (decision === 'approve') {
        await db.user.update({
          where: { id: event.userId },
          data: { riskScore: { decrement: event.score >= 60 ? 1 : 0 } },
        });
      }
      await db.moderationEvent.update({
        where: { id },
        data: { resolved: true, reviewedBy: admin.id },
      });
      await db.auditLog.create({
        data: { adminId: admin.id, action: `moderation.${decision}`, targetType: event.targetType, targetId: event.targetId },
      });
    });
    return { ok: true };
  });
}
