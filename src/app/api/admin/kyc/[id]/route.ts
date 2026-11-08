import { requireElevatedAdmin, getIp } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

/** Review a KYC application: approve / reject / request additional information. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const admin = await requireElevatedAdmin();
    const { id } = await ctx.params;
    const { decision, note } = await req.json();
    if (!['APPROVED', 'REJECTED', 'INFO_REQUIRED'].includes(decision)) throw new Error('Invalid decision');
    if (decision !== 'APPROVED' && !note) throw new Error('A reason/note is required for this decision');

    const kyc = await prisma.kycApplication.update({
      where: { id },
      data: { status: decision, note: note || null, reviewedBy: admin.id },
    });

    if (decision === 'APPROVED') {
      const u = await prisma.user.findUnique({ where: { id: kyc.userId }, select: { kycLevel: true } });
      await prisma.user.update({
        where: { id: kyc.userId },
        data: { kycLevel: Math.max(u?.kycLevel ?? 0, 2) },
      });
    }

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: `kyc.${String(decision).toLowerCase()}`,
        targetType: 'KYC',
        targetId: id,
        meta: { userId: kyc.userId, note },
        ip: getIp(req),
      },
    });
    return { kyc: { id: kyc.id, status: kyc.status } };
  });
}
