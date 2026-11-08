import { requireElevatedAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';
import { paytellerConfig, paytellerMode, testCredentials } from '@/lib/payteller';

/**
 * Admin: PAYTELLER PAYMENTS — searchable, filterable list of gateway deposits
 * with daily totals and webhook delivery insight. Read-only: financial records
 * can only change through verified settlement (or the audited Finance tab).
 */
export async function GET(req: Request) {
  return api(async () => {
    await requireElevatedAdmin();
    const url = new URL(req.url);
    const status = url.searchParams.get('status') ?? '';
    const q = (url.searchParams.get('q') ?? '').trim();

    const where = {
      gateway: 'payteller',
      ...(status ? { status: status as never } : {}),
      ...(q
        ? {
            OR: [
              { id: { contains: q } },
              { gatewayRef: { contains: q } },
              { user: { email: { contains: q, mode: 'insensitive' as const } } },
              { user: { username: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [payments, todayCompleted, todayCount, counts, recentEvents] = await Promise.all([
      prisma.depositIntent.findMany({
        where,
        include: { user: { select: { username: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.depositIntent.aggregate({
        where: { gateway: 'payteller', status: 'COMPLETED', updatedAt: { gte: todayStart } },
        _sum: { amountGHS: true },
        _count: true,
      }),
      prisma.depositIntent.count({ where: { gateway: 'payteller', createdAt: { gte: todayStart } } }),
      prisma.depositIntent.groupBy({
        by: ['status'],
        where: { gateway: 'payteller' },
        _count: true,
      }),
      prisma.webhookEvent.findMany({
        where: { gateway: 'payteller' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, type: true, reference: true, createdAt: true },
      }),
    ]);

    const cfg = paytellerConfig();
    return {
      mode: paytellerMode(),
      merchantId: cfg.merchantId ?? null,
      webhookConfigured: Boolean(cfg.webhookSecret),
      payments,
      stats: {
        todayTotalGHS: Number(todayCompleted._sum.amountGHS ?? 0),
        todaySuccessCount: todayCompleted._count,
        todayStartedCount: todayCount,
        byStatus: Object.fromEntries(counts.map((c) => [c.status, c._count])),
      },
      recentEvents,
    };
  });
}

/** Admin: test the configured live credentials against GET /auth. */
export async function POST(req: Request) {
  return api(async () => {
    const admin = await requireElevatedAdmin();
    const { action } = await req.json();
    if (action !== 'test-credentials') throw new Error('Unknown action');
    const result = await testCredentials();
    await prisma.auditLog.create({
      data: { adminId: admin.id, action: 'payteller.test_credentials', meta: { ok: result.ok, status: result.status } },
    });
    return result;
  });
}
