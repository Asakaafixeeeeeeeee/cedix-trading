import { prisma } from '@/lib/db';
import { notifyUser, sendMomoSms, buildMomoReceipt } from '@/lib/notify';

/**
 * Finalise a withdrawal whose payout has been confirmed: marks it COMPLETED,
 * completes the ledger transaction, sends the USD confirmation (CediX Trading)
 * and the GHS receipt (MobileMoney). Shared by admin completion and the
 * automatic-processing path. Callers must only invoke this after a real payout.
 */
export async function finalizeWithdrawal(withdrawalId: string, actorId: string | null) {
  const wd = await prisma.withdrawal.findUniqueOrThrow({ where: { id: withdrawalId } });
  const reference = `CEDIX-${wd.id.slice(-8).toUpperCase()}`;
  await prisma.$transaction(async (db) => {
    await db.withdrawal.update({ where: { id: wd.id }, data: { status: 'COMPLETED' } });
    await db.transaction.updateMany({
      where: { userId: wd.userId, type: 'WITHDRAWAL', meta: { path: ['withdrawalId'], equals: wd.id } },
      data: { status: 'COMPLETED' },
    });
  });
  if (actorId) {
    await prisma.auditLog.create({ data: { adminId: actorId, action: 'withdrawal.complete', targetType: 'WITHDRAWAL', targetId: wd.id } });
  }
  await notifyUser(wd.userId, {
    kind: 'withdrawal_completed',
    vars: {
      amountUSD: `$${Number(wd.amountUSD).toFixed(2)}`,
      amountGHS: `GH₵${Number(wd.amountGHS).toFixed(2)}`,
      reference,
      reason: '',
      providerRef: wd.providerRef ?? '',
    },
    meta: { withdrawalId: wd.id },
  }).catch((e) => console.error('withdrawal_completed notify failed', e));
  const receipt = await buildMomoReceipt({
    amountGHS: Number(wd.amountGHS),
    destination: wd.destination,
    providerRef: wd.providerRef,
    feeGHS: 0,
    userId: wd.userId,
  });
  const momo = await sendMomoSms(wd.userId, receipt).catch((e) => ({ delivered: false, reason: String(e) }));
  if (!momo.delivered) console.error('momo receipt not delivered', momo.reason);
  return { momoReceipt: momo.delivered };
}
