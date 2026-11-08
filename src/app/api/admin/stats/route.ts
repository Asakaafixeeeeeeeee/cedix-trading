import { requireElevatedAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

/** Full admin overview: 20 real metrics + recent platform activity. */
export async function GET() {
  return api(async () => {
    await requireElevatedAdmin();
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      users,
      activeUsers,
      newUsersToday,
      suspendedUsers,
      depositsTotal,
      withdrawalsTotal,
      depositsToday,
      withdrawalsToday,
      pendingDeposits,
      pendingWithdrawals,
      failedTx,
      successTxToday,
      tradeVolume,
      activeOrders,
      completedTrades,
      pendingP2P,
      pendingKyc,
      messagingUsers,
      notifsToday,
      failedNotifs,
      // extras for existing panels
      posts,
      flagged,
      openDisputes,
      trades24h,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { status: { in: ['SUSPENDED', 'BLOCKED'] } } }),
      prisma.depositIntent.aggregate({ where: { status: 'COMPLETED' }, _sum: { amountGHS: true }, _count: true }),
      prisma.withdrawal.aggregate({ where: { status: 'COMPLETED' }, _sum: { amountGHS: true }, _count: true }),
      prisma.depositIntent.aggregate({ where: { status: 'COMPLETED', updatedAt: { gte: todayStart } }, _sum: { amountGHS: true } }),
      prisma.withdrawal.aggregate({ where: { status: { in: ['COMPLETED', 'PAYMENT_SENT'] }, updatedAt: { gte: todayStart } }, _sum: { amountGHS: true } }),
      prisma.depositIntent.count({ where: { status: { in: ['INITIATED', 'AWAITING_PAYMENT', 'PROCESSING'] } } }),
      prisma.withdrawal.count({ where: { status: { in: ['PENDING_REVIEW', 'PROCESSING', 'APPROVED', 'PAYMENT_SENT'] } } }),
      prisma.transaction.count({ where: { status: 'FAILED' } }),
      prisma.transaction.count({ where: { status: 'COMPLETED', createdAt: { gte: todayStart } } }),
      prisma.$queryRaw<[{ vol: number | null }]>`SELECT COALESCE(SUM(price * quantity), 0)::float8 AS vol FROM "Trade"`,
      prisma.order.count({ where: { status: 'OPEN' } }),
      prisma.trade.count(),
      prisma.p2POrder.count({ where: { status: { in: ['PENDING_PAYMENT', 'PAID'] } } }),
      prisma.kycApplication.count({ where: { status: 'PENDING' } }),
      prisma.messagesAccount.count({ where: { suspended: false, registeredAt: { not: null } } }),
      prisma.message.count({ where: { sender: 'SYSTEM', createdAt: { gte: todayStart } } }),
      prisma.message.count({ where: { pushStatus: 'failed' } }),
      prisma.orbitPost.count(),
      prisma.moderationEvent.count({ where: { resolved: false } }),
      prisma.p2POrder.count({ where: { status: 'DISPUTED' } }),
      prisma.trade.count({ where: { createdAt: { gte: dayAgo } } }),
    ]);

    // Recent platform activity — genuine recorded events only
    const [recentUsers, recentDeposits, recentWithdrawals, recentKyc] = await Promise.all([
      prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { username: true, email: true, createdAt: true, status: true } }),
      prisma.depositIntent.findMany({ orderBy: { updatedAt: 'desc' }, take: 6, include: { user: { select: { username: true } } } }),
      prisma.withdrawal.findMany({ orderBy: { updatedAt: 'desc' }, take: 6, include: { user: { select: { username: true } } } }),
      prisma.kycApplication.findMany({ orderBy: { createdAt: 'desc' }, take: 4, include: { user: { select: { username: true } } } }),
    ]);

    type Activity = { type: string; user: string; detail: string; status: string; at: string; section: string };
    const activity: Activity[] = [
      ...recentUsers.map((u) => ({
        type: 'Registration',
        user: u.username,
        detail: u.email,
        status: u.status,
        at: u.createdAt.toISOString(),
        section: 'users',
      })),
      ...recentDeposits.map((d) => ({
        type: 'Deposit',
        user: d.user.username,
        detail: `GH₵${Number(d.amountGHS).toFixed(2)} → ${d.asset}`,
        status: d.status,
        at: d.updatedAt.toISOString(),
        section: 'payteller',
      })),
      ...recentWithdrawals.map((w) => ({
        type: 'Withdrawal',
        user: w.user.username,
        detail: `GH₵${Number(w.amountGHS).toFixed(2)} (${w.method})`,
        status: w.status,
        at: w.updatedAt.toISOString(),
        section: 'withdrawals',
      })),
      ...recentKyc.map((k) => ({
        type: 'KYC',
        user: k.user.username,
        detail: 'Identity verification submitted',
        status: k.status,
        at: k.createdAt.toISOString(),
        section: 'kyc',
      })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 12);

    return {
      // Users
      users,
      activeUsers,
      newUsersToday,
      suspendedUsers,
      // Financial
      depositVolumeGHS: Number(depositsTotal._sum.amountGHS ?? 0),
      withdrawalVolumeGHS: Number(withdrawalsTotal._sum.amountGHS ?? 0),
      depositTodayGHS: Number(depositsToday._sum.amountGHS ?? 0),
      withdrawalTodayGHS: Number(withdrawalsToday._sum.amountGHS ?? 0),
      depositCount: depositsTotal._count,
      withdrawalCount: withdrawalsTotal._count,
      // Payments
      pendingDeposits,
      pendingWithdrawals,
      failedTx,
      successTxToday,
      // Trading
      tradeVolumeUSD: Number(tradeVolume[0]?.vol ?? 0),
      activeOrders,
      completedTrades,
      pendingP2P,
      // System
      pendingKyc,
      messagingUsers,
      notifsToday,
      failedNotifs,
      // extras used elsewhere
      posts,
      flagged,
      openDisputes,
      trades24h,
      newUsers24h: newUsersToday,
      orders: activeOrders,
      activity,
    };
  });
}
