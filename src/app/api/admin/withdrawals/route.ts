import { api } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireElevatedAdmin } from '@/lib/auth';
import { notifyUser, sendMomoSms, buildMomoReceipt } from '@/lib/notify';

/**
 * Admin: WITHDRAWAL MANAGEMENT — review pipeline.
 *
 *   PENDING_REVIEW ──approve──► APPROVED ──mark-sent──► PAYMENT_SENT ──complete──► COMPLETED
 *        │                         │
 *        └────────reject───────────┘──► REJECTED (funds refunded)
 *
 * Approval never sends money by itself. "Payment sent" requires the real
 * provider transaction reference, and "completed" is recorded only after the
 * operator confirms the transfer — matching Payteller's manual payout model.
 */
export async function GET() {
  return api(async () => {
    await requireElevatedAdmin();
    const withdrawals = await prisma.withdrawal.findMany({
      include: { user: { select: { username: true, email: true, kycLevel: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    const counts = await prisma.withdrawal.groupBy({ by: ['status'], _count: true });
    return { withdrawals, counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) };
  });
}

export async function PATCH(req: Request) {
  return api(async () => {
    const admin = await requireElevatedAdmin();
    const { id, action, reason, providerRef } = await req.json();
    const wd = await prisma.withdrawal.findUnique({ where: { id }, include: { user: true } });
    if (!wd) throw new Error('Withdrawal not found');

    const reference = `CEDIX-${wd.id.slice(-8).toUpperCase()}`;
    const vars = {
      amountUSD: `$${Number(wd.amountUSD).toFixed(2)}`,
      amountGHS: `GH₵${Number(wd.amountGHS).toFixed(2)}`,
      reference,
      reason: String(reason ?? ''),
      providerRef: String(providerRef ?? ''),
    };
    const audit = (a: string, meta?: Record<string, string | number | boolean>) =>
      prisma.auditLog.create({
        data: { adminId: admin.id, action: `withdrawal.${a}`, targetType: 'WITHDRAWAL', targetId: wd.id, meta: meta ? { ...meta } : undefined },
      });

    if (action === 'approve') {
      if (wd.status !== 'PENDING_REVIEW' && wd.status !== 'PROCESSING') throw new Error(`Cannot approve a ${wd.status} withdrawal`);
      await prisma.withdrawal.update({
        where: { id },
        data: { status: 'APPROVED', reviewedAt: new Date(), reviewNote: reason ? String(reason).slice(0, 500) : null },
      });
      await audit('approve');
      notifyUser(wd.userId, { kind: 'withdrawal_approved', vars, meta: { withdrawalId: wd.id } }).catch(() => {});
      return { ok: true };
    }

    if (action === 'reject') {
      if (!['PENDING_REVIEW', 'PROCESSING', 'APPROVED'].includes(wd.status)) throw new Error(`Cannot reject a ${wd.status} withdrawal`);
      if (!reason || String(reason).trim().length < 3) throw new Error('A rejection reason is required');
      await prisma.$transaction(async (db) => {
        // Refund the held funds
        await db.wallet.upsert({
          where: { userId_asset: { userId: wd.userId, asset: wd.asset } },
          update: { available: { increment: Number(wd.amountAsset) } },
          create: { userId: wd.userId, asset: wd.asset, available: Number(wd.amountAsset) },
        });
        await db.withdrawal.update({
          where: { id },
          data: { status: 'REJECTED', reviewedAt: new Date(), reviewNote: String(reason).slice(0, 500) },
        });
        await db.transaction.updateMany({
          where: { userId: wd.userId, type: 'WITHDRAWAL', meta: { path: ['withdrawalId'], equals: wd.id } },
          data: { status: 'FAILED' },
        });
      });
      await audit('reject', { reason: String(reason).slice(0, 200) });
      notifyUser(wd.userId, { kind: 'withdrawal_rejected', vars, meta: { withdrawalId: wd.id } }).catch(() => {});
      return { ok: true };
    }

    if (action === 'mark-sent') {
      if (wd.status !== 'APPROVED') throw new Error('Only approved withdrawals can be marked as paid');
      if (!providerRef || String(providerRef).trim().length < 4) {
        throw new Error('The provider transaction reference is required to record a payment');
      }
      await prisma.withdrawal.update({
        where: { id },
        data: { status: 'PAYMENT_SENT', providerRef: String(providerRef).trim().slice(0, 100), paidAt: new Date() },
      });
      await audit('payment_sent', { providerRef: String(providerRef).slice(0, 100) });
      notifyUser(wd.userId, { kind: 'withdrawal_payment_sent', vars, meta: { withdrawalId: wd.id } }).catch(() => {});
      return { ok: true };
    }

    if (action === 'complete') {
      if (wd.status !== 'PAYMENT_SENT') throw new Error('Record the sent payment (with its provider reference) first');
      await prisma.$transaction(async (db) => {
        await db.withdrawal.update({ where: { id }, data: { status: 'COMPLETED' } });
        await db.transaction.updateMany({
          where: { userId: wd.userId, type: 'WITHDRAWAL', meta: { path: ['withdrawalId'], equals: wd.id } },
          data: { status: 'COMPLETED' },
        });
      });
      await audit('complete');
      // 1. CediX Trading — USD withdrawal confirmation.
      notifyUser(wd.userId, {
        kind: 'withdrawal_completed',
        vars: { ...vars, providerRef: wd.providerRef ?? '' },
        meta: { withdrawalId: wd.id },
      }).catch(() => {});
      // 2. MobileMoney — GHS receipt only (never USD). Built from verified
      //    records; provider transaction id is the real recorded reference.
      //    Awaited so a delivery failure is surfaced, not silently swallowed.
      const receipt = await buildMomoReceipt({
        amountGHS: Number(wd.amountGHS),
        destination: wd.destination,
        providerRef: wd.providerRef,
        feeGHS: 0,
      });
      const momo = await sendMomoSms(wd.userId, receipt).catch((e) => ({ delivered: false, reason: String(e) }));
      await audit('momo_receipt', { delivered: momo.delivered, reason: momo.reason ?? '' });
      return { ok: true, momoReceipt: momo.delivered };
    }

    // Resend the MobileMoney GHS receipt for an already-completed withdrawal
    // (fixes a receipt that failed to deliver). No duplicate CediX message.
    if (action === 'resend-momo') {
      if (wd.status !== 'COMPLETED') throw new Error('Only completed withdrawals have a MobileMoney receipt');
      const receipt = await buildMomoReceipt({
        amountGHS: Number(wd.amountGHS),
        destination: wd.destination,
        providerRef: wd.providerRef,
        feeGHS: 0,
      });
      const momo = await sendMomoSms(wd.userId, receipt);
      await audit('momo_resend', { delivered: momo.delivered, reason: momo.reason ?? '' });
      if (!momo.delivered) throw new Error(`Could not deliver: ${momo.reason ?? 'unknown'}. Ensure the user has activated Messages.`);
      return { ok: true };
    }

    throw new Error('Unknown action');
  });
}
