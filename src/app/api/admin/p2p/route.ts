import { requireElevatedAdmin, getIp } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { unlockFunds, spendLocked, credit } from '@/lib/wallet';
import { api } from '@/lib/api';
import { getP2PSettings } from '@/lib/p2p';
import { getLimits } from '@/lib/limits';

/** Admin P2P management: all offers and orders (disputes first). */
export async function GET() {
  return api(async () => {
    await requireElevatedAdmin();
    const [offers, orders, settings, limits] = await Promise.all([
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
      getP2PSettings(),
      getLimits(),
    ]);
    const disputes = orders.filter((o) => o.status === 'DISPUTED');
    return { offers, orders, disputes, settings, limits };
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

    if (kind === 'settings') {
      const body = await Promise.resolve(action as Record<string, unknown>);
      const updates: Array<[string, boolean | number]> = [];
      if (typeof body?.enabled === 'boolean') updates.push(['p2p_enabled', body.enabled]);
      if (typeof body?.expressEnabled === 'boolean') updates.push(['p2p_express_enabled', body.expressEnabled]);
      if (typeof body?.assistantEnabled === 'boolean') updates.push(['p2p_assistant_enabled', body.assistantEnabled]);
      if (typeof body?.expiryMinutes === 'number' && body.expiryMinutes >= 5 && body.expiryMinutes <= 240) updates.push(['p2p_expiry_minutes', body.expiryMinutes]);
      if (typeof body?.feePct === 'number' && body.feePct >= 0 && body.feePct <= 10) updates.push(['p2p_fee_pct', body.feePct]);
      if (typeof body?.minDepositUSD === 'number' && body.minDepositUSD >= 0) updates.push(['min_deposit_usd', body.minDepositUSD]);
      if (typeof body?.minWithdrawalUSD === 'number' && body.minWithdrawalUSD >= 0) updates.push(['min_withdrawal_usd', body.minWithdrawalUSD]);
      if (updates.length === 0) throw new Error('No valid settings supplied');
      for (const [key, value] of updates) {
        await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
      }
      await prisma.auditLog.create({
        data: { adminId: admin.id, action: 'p2p.settings', targetType: 'SETTINGS', targetId: 'p2p', meta: Object.fromEntries(updates), ip },
      });
      return { ok: true };
    }

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
