// Deposit settlement — the ONLY place a Payteller deposit may credit a wallet.
// Both the webhook receiver and the status-reconciliation poller call this;
// an atomic status-guarded update makes crediting exactly-once even when a
// webhook and a poll race each other.

import { prisma } from './db';
import { credit } from './wallet';
import { notifyUser } from './notify';

export type SettleOutcome = 'successful' | 'failed';

const OPEN_STATUSES = ['INITIATED', 'AWAITING_PAYMENT', 'PROCESSING'] as const;

/**
 * Settle a deposit intent after its outcome has been VERIFIED against
 * Payteller (signed webhook + authenticated verify API — never a browser
 * redirect). Returns what happened so callers can respond accordingly.
 */
export async function settleDeposit(intentId: string, outcome: SettleOutcome): Promise<'credited' | 'marked-failed' | 'already-settled' | 'not-found'> {
  const intent = await prisma.depositIntent.findUnique({ where: { id: intentId } });
  if (!intent) return 'not-found';

  if (outcome === 'failed') {
    const res = await prisma.depositIntent.updateMany({
      where: { id: intentId, status: { in: [...OPEN_STATUSES] } },
      data: { status: 'FAILED' },
    });
    return res.count === 1 ? 'marked-failed' : 'already-settled';
  }

  return prisma.$transaction(async (db) => {
    // Atomic guard: only one concurrent settler can flip the status.
    const res = await db.depositIntent.updateMany({
      where: { id: intentId, status: { in: [...OPEN_STATUSES] } },
      data: { status: 'COMPLETED' },
    });
    if (res.count !== 1) return 'already-settled';

    await credit(db, intent.userId, intent.asset, Number(intent.amountAsset));
    await db.transaction.create({
      data: {
        userId: intent.userId,
        type: 'DEPOSIT',
        asset: intent.asset,
        amount: intent.amountAsset,
        note: `Deposit GHS ${intent.amountGHS} → ${intent.asset} via Payteller (${intent.method})`,
        meta: { depositId: intent.id, amountGHS: Number(intent.amountGHS), rate: Number(intent.rateGHSUSD) },
      },
    });
    return 'credited';
  }).then((result) => {
    if (result === 'credited') {
      // Fire-and-forget Messages/email notification; never blocks settlement.
      notifyUser(intent.userId, {
        kind: 'deposit_completed',
        vars: {
          amountGHS: `GH₵${Number(intent.amountGHS).toFixed(2)}`,
          amountAsset: `${Number(intent.amountAsset)} ${intent.asset}`,
          reference: `CEDIX-${intent.id.slice(-8).toUpperCase()}`,
        },
        meta: { depositId: intent.id },
      }).catch(() => {});
    }
    return result;
  });
}
