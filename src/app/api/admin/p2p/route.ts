import { requireElevatedAdmin, getIp } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { unlockFunds, spendLocked, credit } from '@/lib/wallet';
import { api } from '@/lib/api';

/** Admin P2P management: all offers and orders (disputes first). */
export async function GET() {
  return api(async () => {
    await requireElevatedAdmin();
    const [offers, orders] = await Promise.all([
      prisma.p2POffer.findMany({
        include: { user: { select: { username: true, email: true } }, _count: { select: { orders: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.p2POrder.findMany({
        include: {
          buyer: { select: { username: true } },
          seller: { select: { username: true } },
          offer: { select: { asset: true } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 100,
      }),
    ]);
    const disputes = orders.filter((o) => o.status === 'DISPUTED');
    return { offers, orders, disputes };
  });
}

/**
 * Admin P2P actions:
 *  - offer.suspend / offer.activate
 *  - dispute.release (escrow → buyer) / dispute.refund (escrow → seller)
 */
export async function PATCH(req: Request) {
  return api(async () => {
    const admin = await requireElevatedAdmin();
    const { kind, id, action } = await req.json();
    const ip = getIp(req);

    if (kind === 'offer') {
      if (!['suspend', 'activate'].includes(action)) throw new Error('Invalid action');
      const offer = await prisma.p2POffer.update({ where: { id }, data: { active: action === 'activate' } });
      await prisma.auditLog.create({
        data: { adminId: admin.id, action: `p2p.offer.${action}`, targetType: 'P2P_OFFER', targetId: id, ip },
      });
      return { offer };
    }

    if (kind === 'dispute') {
      const order = await prisma.p2POrder.findUnique({ where: { id } });
      if (!order || order.status !== 'DISPUTED') throw new Error('Order is not disputed');
      if (!['release', 'refund'].includes(action)) throw new Error('Invalid action');

      const updated = await prisma.$transaction(async (db) => {
        if (action === 'release') {
          // buyer paid: release escrow to buyer
          await spendLocked(db, order.sellerId, order.asset, Number(order.amount));
          await credit(db, order.buyerId, order.asset, Number(order.amount));
          return db.p2POrder.update({ where: { id }, data: { status: 'RELEASED' } });
        }
        // refund escrow to seller and restore offer volume
        await unlockFunds(db, order.sellerId, order.asset, Number(order.amount));
        await db.p2POffer.update({ where: { id: order.offerId }, data: { available: { increment: Number(order.amount) } } });
        return db.p2POrder.update({ where: { id }, data: { status: 'CANCELLED' } });
      });

      await prisma.auditLog.create({
        data: {
          adminId: admin.id,
          action: `p2p.dispute.${action}`,
          targetType: 'P2P_ORDER',
          targetId: id,
          meta: { buyerId: order.buyerId, sellerId: order.sellerId, amount: Number(order.amount), asset: order.asset },
          ip,
        },
      });
      return { order: updated };
    }

    throw new Error('Unknown kind');
  });
}
