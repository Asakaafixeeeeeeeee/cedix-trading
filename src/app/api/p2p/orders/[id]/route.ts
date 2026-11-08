import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { unlockFunds, spendLocked, credit } from '@/lib/wallet';
import { api } from '@/lib/api';

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
