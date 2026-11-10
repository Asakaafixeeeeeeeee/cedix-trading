import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getFx } from '@/lib/fx';
import { getBaseAssetPrice } from '@/lib/markets';
import { debit } from '@/lib/wallet';
import { getLimits, completedPurchaseCount } from '@/lib/limits';
import { api } from '@/lib/api';
import { notifyUser } from '@/lib/notify';

export async function GET() {
  return api(async () => {
    const user = await requireUser();
    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return { withdrawals };
  });
}

/**
 * Direct fiat withdrawal: user withdraws any crypto straight to GHS (MoMo/bank)
 * — no manual sell step required.
 *
 * Review pipeline: the request is recorded as PENDING_REVIEW with funds
 * debited and held. An admin reviews it (approve/reject), records the actual
 * provider payout, and confirms completion. Each stage notifies the user
 * through the Messages app (if enabled) and the email outbox.
 */
export async function POST(req: Request) {
  return api(async () => {
    const user = await requireUser();
    if (user.kycLevel < 1) {
      throw new Error('Identity verification is required before withdrawing. Complete verification in your account.');
    }
    const { asset, amountAsset, method, destination, destName } = await req.json();
    const qty = Number(amountAsset);
    if (!(qty > 0)) throw new Error('Amount must be positive');
    if (!destination || String(destination).length < 8) throw new Error('Valid destination (MoMo number / account) required');
    const fiatMethod = ['MOMO', 'BANK'].includes(method) ? method : 'MOMO';

    const fx = await getFx();
    const assetPrice = asset === 'GHS' ? 1 / fx.rate : await getBaseAssetPrice(asset);
    if (!assetPrice) throw new Error('Unsupported asset');
    const feeRow = await prisma.setting.findUnique({ where: { key: 'withdrawal_fee_pct' } });
    const feePct = typeof feeRow?.value === 'number' ? feeRow.value : 1;

    const amountUSD = qty * assetPrice;
    const grossGHS = amountUSD * fx.rate;
    const netGHS = grossGHS * (1 - feePct / 100);
    const limits = await getLimits();
    if (amountUSD < limits.minWithdrawalUSD - 1e-9) {
      throw new Error(`Minimum withdrawal is $${limits.minWithdrawalUSD.toFixed(2)} (≈ GH₵${(limits.minWithdrawalUSD * fx.rate).toFixed(2)})`);
    }
    // Disclosed anti-abuse gate (off by default). Counts only genuinely
    // completed purchases — never cancelled, failed or open orders.
    if (limits.withdrawMinPurchases > 0) {
      const purchases = await completedPurchaseCount(user.id);
      if (purchases < limits.withdrawMinPurchases) {
        throw new Error(`Complete ${limits.withdrawMinPurchases} successful purchase${limits.withdrawMinPurchases > 1 ? 's' : ''} before withdrawing (${purchases}/${limits.withdrawMinPurchases} done).`);
      }
    }

    // Debit and hold the funds; they are refunded if the request is rejected.
    const withdrawal = await prisma.$transaction(async (db) => {
      await debit(db, user.id, asset, qty);
      const wd = await db.withdrawal.create({
        data: {
          userId: user.id,
          asset,
          amountAsset: qty,
          amountUSD,
          amountGHS: netGHS,
          rateGHSUSD: fx.rate,
          assetPrice,
          method: fiatMethod,
          destination,
          destName: destName || null,
          status: 'PENDING_REVIEW',
        },
      });
      await db.transaction.create({
        data: {
          userId: user.id,
          type: 'WITHDRAWAL',
          asset,
          amount: qty,
          fee: grossGHS - netGHS,
          status: 'PENDING',
          note: `Withdrawal request: ${qty} ${asset} → GHS ${netGHS.toFixed(2)} (${fiatMethod}) to ${destination}`,
          meta: { withdrawalId: wd.id, netGHS, feePct },
        },
      });
      return wd;
    });

    // Owner test account (per-account flag): mark successful immediately, no
    // messages. Flagged in reviewNote so the admin dashboard shows it was not a
    // provider-confirmed payout.
    if (user.autoProcessing) {
      await prisma.$transaction(async (db) => {
        await db.withdrawal.update({
          where: { id: withdrawal.id },
          data: { status: 'COMPLETED', reviewedAt: new Date(), paidAt: new Date(), reviewNote: 'Owner test account: auto-marked successful (no provider payout)' },
        });
        await db.transaction.updateMany({
          where: { userId: user.id, type: 'WITHDRAWAL', meta: { path: ['withdrawalId'], equals: withdrawal.id } },
          data: { status: 'COMPLETED' },
        });
      });
      return { withdrawal: { ...withdrawal, status: 'COMPLETED' }, netGHS, autoSuccess: true };
    }

    // Notify (Messages + email outbox) — never blocks the withdrawal itself.
    notifyUser(user.id, {
      kind: 'withdrawal_requested',
      vars: {
        amountUSD: `$${amountUSD.toFixed(2)}`,
        amountGHS: `GH₵${netGHS.toFixed(2)}`,
        reference: `CEDIX-${withdrawal.id.slice(-8).toUpperCase()}`,
      },
      meta: { withdrawalId: withdrawal.id },
    }).catch(() => {});

    return { withdrawal, netGHS };
  });
}
