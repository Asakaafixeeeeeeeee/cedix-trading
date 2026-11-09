import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { unlockFunds, spendLocked, credit } from '@/lib/wallet';
import { api } from '@/lib/api';
import { addP2PChat, expireP2POrderIfDue, orderNumber, releaseP2POrder } from '@/lib/p2p';
import { createPayment, verifyPayment, isSuccessStatus } from '@/lib/payteller';

async function loadOrder(id: string, userId: string) {
  const order = await prisma.p2POrder.findUnique({
    where: { id },
    include: {
      offer: { select: { paymentMethods: true, terms: true } },
      buyer: { select: { username: true, displayName: true, email: true } },
      seller: { select: { username: true, displayName: true } },
    },
  });
  if (!order || (order.buyerId !== userId && order.sellerId !== userId)) throw new Error('Order not found');
  return order;
}

// Throttle provider verification to one call per order per 5 seconds.
const lastVerify = new Map<string, number>();

/** Order details + assistant conversation (expires/verifies server-side). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    let order = await loadOrder(id, user.id);

    // Server-side timer: expire overdue unpaid orders (final provider check inside).
    const after = await expireP2POrderIfDue(order);
    if (after.status !== order.status) order = await loadOrder(id, user.id);

    // Backend payment verification — release only on provider-confirmed success.
    if (order.status === 'PENDING_PAYMENT' && order.providerPaymentId) {
      const last = lastVerify.get(id) ?? 0;
      if (Date.now() - last > 5000) {
        lastVerify.set(id, Date.now());
        try {
          const payment = await verifyPayment(order.providerPaymentId);
          if (payment && isSuccessStatus(payment.status)) {
            await releaseP2POrder(id, { paymentId: order.providerPaymentId, reference: payment.provider_reference });
            order = await loadOrder(id, user.id);
          }
        } catch {
          /* provider unreachable — try again on next poll */
        }
      }
    }

    const chat = await prisma.p2PChatMessage.findMany({ where: { orderId: id }, orderBy: { createdAt: 'asc' }, take: 200 });
    return {
      order: { ...order, orderNo: orderNumber(order) },
      chat,
      myId: user.id,
      serverNow: Date.now(),
    };
  });
}

/**
 * Assistant conversation actions (buyer side):
 *  - { type: 'message', body }            → store a buyer message
 *  - { type: 'choose-network', network }  → create the official Payteller checkout
 *  - { type: 'verify' }                   → backend verification poll
 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();
    let order = await loadOrder(id, user.id);
    order = Object.assign(order, await expireP2POrderIfDue(order));

    if (body.type === 'message') {
      const text = String(body.body ?? '').trim().slice(0, 1000);
      if (!text) throw new Error('Empty message');
      const role = order.buyerId === user.id ? 'BUYER' : 'SELLER';
      const msg = await addP2PChat(id, role, text);
      return { message: msg };
    }

    if (body.type === 'choose-network') {
      if (order.buyerId !== user.id) throw new Error('Only the buyer can pay this order');
      if (order.status !== 'PENDING_PAYMENT') throw new Error(`This order is ${order.status.toLowerCase().replace('_', ' ')} — payment is closed`);
      const network = ['MTN Mobile Money', 'Telecel Cash'].includes(body.network) ? body.network : 'MTN Mobile Money';

      await addP2PChat(id, 'BUYER', network, { kind: 'network-choice' });

      // Build the public return URL (Render proxy: trust x-forwarded-host).
      const rawHost = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').split(',')[0].trim().replace(/:\d+$/, '');
      const isLocal = !rawHost || rawHost === 'localhost' || rawHost.startsWith('127.') || rawHost.startsWith('192.168.');
      const reference = `P2P-${id.slice(-20)}-${Date.now().toString(36)}`.toUpperCase();
      const payment = await createPayment({
        reference,
        amountGHS: Number(order.totalGHS),
        customerEmail: order.buyer.email,
        description: `CediX P2P order ${orderNumber(order)} — ${Number(order.amount).toFixed(6)} ${order.asset}`,
        returnUrl: isLocal ? undefined : `https://${rawHost}/m/p2p/order/${id}`,
      });

      await prisma.p2POrder.update({
        where: { id },
        data: { paymentMethod: network, providerPaymentId: payment.gatewayRef },
      });

      const confirm = await addP2PChat(
        id,
        'ASSISTANT',
        `Your payment of GH₵${Number(order.totalGHS).toFixed(2)} for order ${orderNumber(order)} is ready. Open the official CediX checkout below to pay with ${network}. Your crypto is released automatically once the payment is confirmed by the provider.`,
        { kind: 'checkout', checkoutUrl: payment.checkoutUrl, network }
      );
      return { message: confirm, checkoutUrl: payment.checkoutUrl };
    }

    if (body.type === 'verify') {
      if (order.status === 'RELEASED') return { status: 'RELEASED' };
      if (order.status !== 'PENDING_PAYMENT' || !order.providerPaymentId) return { status: order.status };
      const payment = await verifyPayment(order.providerPaymentId);
      if (payment && isSuccessStatus(payment.status)) {
        const updated = await releaseP2POrder(id, { paymentId: order.providerPaymentId, reference: payment.provider_reference });
        return { status: updated.status };
      }
      if (payment && payment.status === 'failed') {
        await addP2PChat(id, 'ASSISTANT', 'Your payment attempt failed. No money was taken, or any debit will be reversed by the provider. You can choose a network below to try again.', {
          kind: 'choose-network',
          options: ['MTN Mobile Money', 'Telecel Cash'],
        });
        return { status: 'FAILED_ATTEMPT' };
      }
      return { status: payment?.status ? `PROVIDER_${payment.status.toUpperCase()}` : order.status };
    }

    throw new Error('Unknown action');
  });
}

/** P2P order lifecycle: buyer marks paid → seller releases escrow; either side can cancel/dispute. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const { action } = await req.json();
    const order = await prisma.p2POrder.findUnique({ where: { id } });
    if (!order || (order.buyerId !== user.id && order.sellerId !== user.id)) {
      throw new Error('Order not found');
    }

    if (action === 'paid') {
      if (order.buyerId !== user.id) throw new Error('Only the buyer can mark as paid');
      if (order.status !== 'PENDING_PAYMENT') throw new Error('Invalid state');
      return { order: await prisma.p2POrder.update({ where: { id }, data: { status: 'PAID' } }) };
    }

    if (action === 'release') {
      if (order.sellerId !== user.id) throw new Error('Only the seller can release');
      if (order.status !== 'PAID') throw new Error('Buyer has not marked payment yet');
      const updated = await prisma.$transaction(async (db) => {
        await spendLocked(db, order.sellerId, order.asset, Number(order.amount));
        await credit(db, order.buyerId, order.asset, Number(order.amount));
        await db.transaction.createMany({
          data: [
            { userId: order.buyerId, type: 'P2P_BUY', asset: order.asset, amount: order.amount, note: `P2P buy for GHS ${order.totalGHS}` },
            { userId: order.sellerId, type: 'P2P_SELL', asset: order.asset, amount: order.amount, note: `P2P sell for GHS ${order.totalGHS}` },
          ],
        });
        return db.p2POrder.update({ where: { id }, data: { status: 'RELEASED' } });
      });
      return { order: updated };
    }

    if (action === 'cancel') {
      if (order.status !== 'PENDING_PAYMENT') throw new Error('Can only cancel before payment');
      const updated = await prisma.$transaction(async (db) => {
        await unlockFunds(db, order.sellerId, order.asset, Number(order.amount));
        await db.p2POffer.update({
          where: { id: order.offerId },
          data: { available: { increment: Number(order.amount) } },
        });
        return db.p2POrder.update({ where: { id }, data: { status: 'CANCELLED' } });
      });
      return { order: updated };
    }

    if (action === 'dispute') {
      if (!['PAID', 'PENDING_PAYMENT'].includes(order.status)) throw new Error('Invalid state');
      return { order: await prisma.p2POrder.update({ where: { id }, data: { status: 'DISPUTED' } }) };
    }

    throw new Error('Unknown action');
  });
}
