// P2P marketplace core: configurable settings, order release/expiry, and the
// CediX Automated Payment Assistant chat. Crypto is ONLY released after the
// payment provider confirms a successful payment (never on "I have paid").

import { prisma } from './db';
import { credit, spendLocked, unlockFunds } from './wallet';
import { verifyPayment, isSuccessStatus } from './payteller';
import { notifyUser } from './notify';
import type { P2PChatRole, P2POrder } from '@/generated/prisma/client';

export type P2PSettings = {
  enabled: boolean;
  expressEnabled: boolean;
  assistantEnabled: boolean;
  expiryMinutes: number;
  feePct: number;
};

const DEFAULTS: P2PSettings = {
  enabled: true,
  expressEnabled: true,
  assistantEnabled: true,
  expiryMinutes: 15,
  feePct: 0.5,
};

export async function getP2PSettings(): Promise<P2PSettings> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['p2p_enabled', 'p2p_express_enabled', 'p2p_assistant_enabled', 'p2p_expiry_minutes', 'p2p_fee_pct'] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const bool = (k: string, d: boolean) => (typeof map.get(k) === 'boolean' ? (map.get(k) as boolean) : d);
  const num = (k: string, d: number) => (typeof map.get(k) === 'number' ? (map.get(k) as number) : d);
  return {
    enabled: bool('p2p_enabled', DEFAULTS.enabled),
    expressEnabled: bool('p2p_express_enabled', DEFAULTS.expressEnabled),
    assistantEnabled: bool('p2p_assistant_enabled', DEFAULTS.assistantEnabled),
    expiryMinutes: Math.max(5, num('p2p_expiry_minutes', DEFAULTS.expiryMinutes)),
    feePct: Math.min(10, Math.max(0, num('p2p_fee_pct', DEFAULTS.feePct))),
  };
}

export async function addP2PChat(orderId: string, role: P2PChatRole, body: string, meta?: object) {
  return prisma.p2PChatMessage.create({
    data: { orderId, role, body, meta: meta ? JSON.parse(JSON.stringify(meta)) : undefined },
  });
}

/** Human-friendly numeric order number shown to customers (per screenshots). */
export function orderNumber(order: { createdAt: Date; id: string }) {
  const d = order.createdAt;
  const digits = order.id.replace(/\D/g, '').slice(-9).padStart(9, '7');
  return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${digits}`;
}

/**
 * Release a confirmed-paid order: escrowed crypto moves to the buyer; the
 * seller is credited the GHS proceeds minus the configured P2P fee.
 * Caller must have verified payment with the provider first.
 */
export async function releaseP2POrder(orderId: string, provider: { paymentId?: string; reference?: string }) {
  const settings = await getP2PSettings();
  const updated = await prisma.$transaction(async (db) => {
    const order = await db.p2POrder.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');
    if (order.status === 'RELEASED') return order; // idempotent
    if (!['PENDING_PAYMENT', 'PAID'].includes(order.status)) throw new Error(`Cannot release order in state ${order.status}`);

    const amount = Number(order.amount);
    const totalGHS = Number(order.totalGHS);
    const feeGHS = +(totalGHS * (settings.feePct / 100)).toFixed(2);
    const sellerGHS = +(totalGHS - feeGHS).toFixed(2);

    await spendLocked(db, order.sellerId, order.asset, amount);
    await credit(db, order.buyerId, order.asset, amount);
    await credit(db, order.sellerId, 'GHS', sellerGHS);

    await db.transaction.createMany({
      data: [
        {
          userId: order.buyerId, type: 'P2P_BUY', asset: order.asset, amount: order.amount, status: 'COMPLETED',
          note: `P2P buy — paid GHS ${totalGHS.toFixed(2)} via ${order.paymentMethod ?? 'checkout'}`,
          meta: { orderId: order.id, providerRef: provider.reference ?? null },
        },
        {
          userId: order.sellerId, type: 'P2P_SELL', asset: order.asset, amount: order.amount, status: 'COMPLETED',
          fee: feeGHS,
          note: `P2P sell — received GHS ${sellerGHS.toFixed(2)} (fee GHS ${feeGHS.toFixed(2)})`,
          meta: { orderId: order.id },
        },
      ],
    });

    return db.p2POrder.update({
      where: { id: orderId },
      data: {
        status: 'RELEASED',
        paidAt: new Date(),
        releasedAt: new Date(),
        feeGHS,
        providerRef: provider.reference ?? undefined,
        providerPaymentId: provider.paymentId ?? undefined,
      },
    });
  });

  if (updated.status === 'RELEASED') {
    await addP2PChat(
      orderId,
      'ASSISTANT',
      `Payment confirmed. ${Number(updated.amount).toFixed(6)} ${updated.asset} has been released to your CediX wallet. Thank you for trading with CediX P2P.`,
      { kind: 'released' }
    ).catch(() => {});
    notifyUser(updated.buyerId, {
      kind: 'p2p_released',
      vars: {
        amountAsset: `${Number(updated.amount).toFixed(6)} ${updated.asset}`,
        amountGHS: `GH₵${Number(updated.totalGHS).toFixed(2)}`,
        reference: orderNumber(updated),
      },
      meta: { orderId },
    }).catch(() => {});
  }
  return updated;
}

/** Expire an unpaid order: final provider check first, then return escrow. */
export async function expireP2POrderIfDue<T extends P2POrder>(order: T): Promise<T | P2POrder> {
  if (order.status !== 'PENDING_PAYMENT') return order;
  if (!order.expiresAt || order.expiresAt.getTime() > Date.now()) return order;

  // One final, authoritative provider check before expiring.
  if (order.providerPaymentId) {
    try {
      const payment = await verifyPayment(order.providerPaymentId);
      if (payment && isSuccessStatus(payment.status)) {
        return releaseP2POrder(order.id, { paymentId: order.providerPaymentId, reference: payment.provider_reference });
      }
    } catch {
      /* provider unreachable — expire pessimistically; reconciliation can still release later via admin */
    }
  }

  const updated = await prisma.$transaction(async (db) => {
    const fresh = await db.p2POrder.findUnique({ where: { id: order.id } });
    if (!fresh || fresh.status !== 'PENDING_PAYMENT') return fresh ?? order;
    await unlockFunds(db, fresh.sellerId, fresh.asset, Number(fresh.amount));
    await db.p2POffer.update({ where: { id: fresh.offerId }, data: { available: { increment: Number(fresh.amount) } } });
    return db.p2POrder.update({ where: { id: fresh.id }, data: { status: 'EXPIRED' } });
  });
  if (updated.status === 'EXPIRED') {
    await addP2PChat(
      order.id,
      'SYSTEM',
      'This order expired before payment was completed. The reserved crypto has been returned to the merchant. You can start a new order at any time.',
      { kind: 'expired' }
    ).catch(() => {});
  }
  return updated;
}

/** Real merchant statistics from recorded orders — never invented. */
export async function merchantStats(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, { trades: number; completionPct: number | null }>();
  const orders = await prisma.p2POrder.findMany({
    where: { sellerId: { in: userIds }, status: { in: ['RELEASED', 'CANCELLED', 'EXPIRED'] } },
    select: { sellerId: true, status: true },
  });
  const map = new Map<string, { trades: number; completionPct: number | null }>();
  for (const id of userIds) {
    const mine = orders.filter((o) => o.sellerId === id);
    const done = mine.filter((o) => o.status === 'RELEASED').length;
    map.set(id, { trades: done, completionPct: mine.length > 0 ? +((done / mine.length) * 100).toFixed(2) : null });
  }
  return map;
}
