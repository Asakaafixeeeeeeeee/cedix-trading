import { requireElevatedAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';
import { credit } from '@/lib/wallet';
import { getFx } from '@/lib/fx';
import { settleDeposit } from '@/lib/deposits';
import { notifyUser } from '@/lib/notify';
import { getPaymentByReference, isSuccessStatus, paytellerConfig, paytellerMode, testCredentials, verifyPayment } from '@/lib/payteller';

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

/** Admin actions: credential test, verified reconciliation, manual credit. */
export async function POST(req: Request) {
  return api(async () => {
    const admin = await requireElevatedAdmin();
    const body = await req.json();
    const { action } = body;

    if (action === 'test-credentials') {
      const result = await testCredentials();
      await prisma.auditLog.create({
        data: { adminId: admin.id, action: 'payteller.test_credentials', meta: { ok: result.ok, status: result.status } },
      });
      return result;
    }

    // ── Payment reconciliation: verify a stuck deposit with Payteller, then
    //    credit EXACTLY-ONCE (settleDeposit's status guard blocks duplicates).
    if (action === 'reconcile') {
      const intentId = String(body.intentId ?? '');
      const reason = String(body.reason ?? '').trim();
      if (reason.length < 4) throw new Error('A reason for this adjustment is required');
      const intent = await prisma.depositIntent.findUnique({ where: { id: intentId } });
      if (!intent) throw new Error('Deposit not found');
      if (intent.status === 'COMPLETED') throw new Error('This deposit is already credited — no action taken');

      if (paytellerMode() !== 'live') throw new Error('Live Payteller credentials are not configured, so this payment cannot be verified');

      // Authoritative provider check — never credit an unverified payment.
      const payment = (intent.gatewayRef && (await verifyPayment(intent.gatewayRef))) || (await getPaymentByReference(intent.id));
      if (!payment) throw new Error('Payteller has no record of this payment reference');
      if (!isSuccessStatus(payment.status)) {
        throw new Error(`Payteller reports this payment as "${payment.status}" — it was not successful, so no credit was made`);
      }

      const result = await settleDeposit(intent.id, 'successful', {
        providerRef: payment.provider_reference ?? payment.transaction_id ?? null,
        customerTotal: payment.amount ?? null,
        customerFee: null,
      });
      await prisma.auditLog.create({
        data: {
          adminId: admin.id,
          action: 'payteller.reconcile',
          targetType: 'DEPOSIT',
          targetId: intent.id,
          meta: {
            result,
            reason,
            providerRef: payment.provider_reference ?? null,
            amountGHS: Number(intent.amountGHS),
            amountAsset: Number(intent.amountAsset),
            asset: intent.asset,
            rateGHSUSD: Number(intent.rateGHSUSD),
          },
        },
      });
      if (result === 'already-settled') throw new Error('This deposit was just credited by another process — no duplicate was made');
      return { ok: true, result, providerRef: payment.provider_reference ?? null };
    }

    // ── Manual balance adjustment (audited). For genuine corrections only.
    if (action === 'manual-credit') {
      const userId = String(body.userId ?? '');
      const asset = String(body.asset ?? 'USDT').toUpperCase();
      const amountUSD = Number(body.amountUSD);
      const reason = String(body.reason ?? '').trim();
      const providerRef = String(body.providerRef ?? '').trim();
      if (!userId) throw new Error('Select a user');
      if (!(amountUSD > 0)) throw new Error('Amount must be positive');
      if (amountUSD > 100000) throw new Error('Amount exceeds the single-adjustment limit');
      if (reason.length < 4) throw new Error('A reason for this adjustment is required');
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) throw new Error('User not found');

      const fx = await getFx();
      // Credit is denominated in USD; for USDT/USDC 1:1, for GHS convert.
      const asset2 = ['USDT', 'USDC', 'USD'].includes(asset) ? 'USDT' : asset;
      const amountAsset = asset2 === 'GHS' ? amountUSD * fx.rate : amountUSD; // USDT ≈ USD

      await prisma.$transaction(async (db) => {
        await credit(db, userId, asset2, amountAsset);
        await db.transaction.create({
          data: {
            userId,
            type: 'ADMIN_ADJUST',
            asset: asset2,
            amount: amountAsset,
            status: 'COMPLETED',
            note: `Admin credit: $${amountUSD.toFixed(2)} — ${reason}`,
            meta: { amountUSD, rateGHSUSD: fx.rate, providerRef: providerRef || null, adminId: admin.id, reason },
          },
        });
      });
      await prisma.auditLog.create({
        data: {
          adminId: admin.id,
          action: 'finance.manual_credit',
          targetType: 'USER',
          targetId: userId,
          meta: { amountUSD, asset: asset2, amountAsset, rateGHSUSD: fx.rate, providerRef: providerRef || null, reason },
        },
      });
      notifyUser(userId, {
        kind: 'deposit_completed',
        vars: {
          amountGHS: `GH₵${(amountUSD * fx.rate).toFixed(2)}`,
          amountAsset: `${amountAsset.toFixed(6)} ${asset2}`,
          reference: `ADJ-${Date.now().toString(36).toUpperCase()}`,
        },
      }).catch(() => {});
      return { ok: true, amountUSD, asset: asset2 };
    }

    throw new Error('Unknown action');
  });
}
