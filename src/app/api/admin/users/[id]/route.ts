import { requireElevatedAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

/** Admin: update a user's status, role, KYC level or Orbit access. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const admin = await requireElevatedAdmin();
    const { id } = await ctx.params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (['ACTIVE', 'SUSPENDED', 'BLOCKED'].includes(body.status)) data.status = body.status;
    if (['USER', 'ADMIN'].includes(body.role)) data.role = body.role;
    if (typeof body.kycLevel === 'number') data.kycLevel = Math.max(0, Math.min(3, body.kycLevel));
    if (typeof body.orbitBanned === 'boolean') data.orbitBanned = body.orbitBanned;
    if (body.resetRisk) data.riskScore = 0;
    if (Object.keys(data).length === 0) throw new Error('Nothing to update');
    if (id === admin.id && data.status && data.status !== 'ACTIVE') throw new Error('Cannot suspend yourself');

    const user = await prisma.user.update({ where: { id }, data });
    await prisma.auditLog.create({
      data: { adminId: admin.id, action: 'user.update', targetType: 'USER', targetId: id, meta: data as object },
    });
    return { user: { id: user.id, status: user.status, role: user.role, kycLevel: user.kycLevel, orbitBanned: user.orbitBanned } };
  });
}
