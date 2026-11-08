import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

export async function GET() {
  return api(async () => {
    await requireAdmin();
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    const [users, activeUsers, newUsers24h, orders, trades24h, deposits, withdrawals, posts, flagged, openDisputes] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
        prisma.order.count(),
        prisma.trade.count({ where: { createdAt: { gte: dayAgo } } }),
        prisma.depositIntent.aggregate({ where: { status: 'COMPLETED' }, _sum: { amountGHS: true }, _count: true }),
        prisma.withdrawal.aggregate({ where: { status: 'COMPLETED' }, _sum: { amountGHS: true }, _count: true }),
        prisma.orbitPost.count(),
        prisma.moderationEvent.count({ where: { resolved: false } }),
        prisma.p2POrder.count({ where: { status: 'DISPUTED' } }),
      ]);
    return {
      users,
      activeUsers,
      newUsers24h,
      orders,
      trades24h,
      depositCount: deposits._count,
      depositVolumeGHS: Number(deposits._sum.amountGHS ?? 0),
      withdrawalCount: withdrawals._count,
      withdrawalVolumeGHS: Number(withdrawals._sum.amountGHS ?? 0),
      posts,
      flagged,
      openDisputes,
    };
  });
}
