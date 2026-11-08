import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { credit } from '@/lib/wallet';
import { api } from '@/lib/api';

/** Admin financial control: list and manage deposits & withdrawals. */
export async function GET() {
  return api(async () => {
    await requireAdmin();
    const [deposits, withdrawals] = await Promise.all([
      prisma.depositIntent.findMany({
        include: { user: { select: { username: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.withdrawal.findMany({
        include: { user: { select: { username: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    return { deposits, withdrawals };
  });
}

/** Admin override: force-complete, fail or cancel a deposit/withdrawal. */
export async function PATCH(req: Request) {
  return api(async () => {
    const admin = await requireAdmin();
    const { kind, id, status } = await req.json();
    if (!['deposit', 'withdrawal'].includes(kind)) throw new Error('kind must be deposit|withdrawal');
    if (!['COMPLETED', 'FAILED', 'CANCELLED'].includes(status)) throw new Error('Invalid status');

    if (kind === 'deposit') {
      const dep = await prisma.depositIntent.findUnique({ where: { id } });
      if (!dep) throw new Error('Not found');
      if (dep.status === 'COMPLETED') throw new Error('Already completed');
      await prisma.$transaction(async (db) => {
        if (status === 'COMPLETED') {
          await credit(db, dep.userId, dep.asset, Number(dep.amountAsset));
          await db.transaction.create({
            data: {
              userId: dep.userId, type: 'DEPOSIT', asset: dep.asset, amount: dep.amountAsset,
              note: `Deposit force-completed by admin`, meta: { depositId: dep.id, adminId: admin.id },
            },
          });
        }
        await db.depositIntent.update({ where: { id }, data: { status } });
        await db.auditLog.create({
          data: { adminId: admin.id, action: `deposit.${status.toLowerCase()}`, targetType: 'DEPOSIT', targetId: id },
        });
      });
    } else {
      const wd = await prisma.withdrawal.findUnique({ where: { id } });
      if (!wd) throw new Error('Not found');
      await prisma.$transaction(async (db) => {
        if (['FAILED', 'CANCELLED'].includes(status) && !['FAILED', 'CANCELLED'].includes(wd.status)) {
          // refund the debited crypto
          await credit(db, wd.userId, wd.asset, Number(wd.amountAsset));
        }
        await db.withdrawal.update({ where: { id }, data: { status } });
        await db.auditLog.create({
          data: { adminId: admin.id, action: `withdrawal.${status.toLowerCase()}`, targetType: 'WITHDRAWAL', targetId: id },
        });
      });
    }
    return { ok: true };
  });
}
