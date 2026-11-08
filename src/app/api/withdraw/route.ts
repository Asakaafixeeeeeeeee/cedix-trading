import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getFx } from '@/lib/fx';
import { getBaseAssetPrice } from '@/lib/markets';
import { createPayout } from '@/lib/payteller';
import { debit } from '@/lib/wallet';
import { api } from '@/lib/api';

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
 * Direct fiat withdrawal: user withdraws any crypto straight to GHS
 * (MoMo/bank) via Payteller — no manual sell step required.
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
    if (netGHS < 10) throw new Error('Minimum withdrawal is GHS 10 (net)');

    // Debit the crypto immediately (conversion handled by the platform)
    const withdrawal = await prisma.$transaction(async (db) => {
      await debit(db, user.id, asset, qty);
      return db.withdrawal.create({
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
          status: 'PROCESSING',
        },
      });
    });

    try {
      const payout = await createPayout({
        reference: withdrawal.id,
        amountGHS: netGHS,
        method: fiatMethod,
        destination,
        destName,
        description: `CediX withdrawal: ${qty} ${asset} → GHS ${netGHS.toFixed(2)}`,
      });

      const finalStatus = payout.status === 'COMPLETED' ? 'COMPLETED' : 'PROCESSING';
      await prisma.$transaction(async (db) => {
        await db.withdrawal.update({
          where: { id: withdrawal.id },
          data: { status: finalStatus, gatewayRef: payout.gatewayRef },
        });
        await db.transaction.create({
          data: {
            userId: user.id,
            type: 'WITHDRAWAL',
            asset,
            amount: qty,
            fee: grossGHS - netGHS,
            status: finalStatus === 'COMPLETED' ? 'COMPLETED' : 'PROCESSING',
            note: `Withdrew ${qty} ${asset} → GHS ${netGHS.toFixed(2)} (${fiatMethod}) to ${destination}`,
            meta: { withdrawalId: withdrawal.id, netGHS, feePct },
          },
        });
      });
      return { withdrawal: { ...withdrawal, status: finalStatus }, netGHS };
    } catch (e) {
      // Refund on gateway failure
      await prisma.$transaction(async (db) => {
        await db.wallet.update({
          where: { userId_asset: { userId: user.id, asset } },
          data: { available: { increment: qty } },
        });
        await db.withdrawal.update({ where: { id: withdrawal.id }, data: { status: 'FAILED' } });
      });
      throw e;
    }
  });
}
