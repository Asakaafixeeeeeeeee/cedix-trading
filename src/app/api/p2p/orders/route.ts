import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { lockFunds } from '@/lib/wallet';
import { api } from '@/lib/api';
import { addP2PChat, expireP2POrderIfDue, getP2PSettings, orderNumber } from '@/lib/p2p';

export async function GET() {
  return api(async () => {
    const user = await requireUser();
    let orders = await prisma.p2POrder.findMany({
      where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
      include: {
        offer: true,
        buyer: { select: { username: true } },
        seller: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    // Lazily expire overdue unpaid orders (server-side timer keeps running)
    for (const o of orders) {
      if (o.status === 'PENDING_PAYMENT' && o.expiresAt && o.expiresAt.getTime() < Date.now()) {
        await expireP2POrderIfDue(o).catch(() => {});
      }
    }
    orders = await prisma.p2POrder.findMany({
      where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
      include: {
        offer: true,
        buyer: { select: { username: true } },
        seller: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { orders: orders.map((o) => ({ ...o, orderNo: orderNumber(o) })), myId: user.id };
  });
}

/** Take a P2P offer. Crypto escrow is locked from the seller. */
export async function POST(req: Request) {
  return api(async () => {
    const user = await requireUser();
    const settings = await getP2PSettings();
    if (!settings.enabled) throw new Error('P2P trading is temporarily unavailable');
    const { offerId, amountGHS } = await req.json();
    const ghs = Number(amountGHS);
    const offer = await prisma.p2POffer.findUnique({ where: { id: offerId } });
    if (!offer || !offer.active) throw new Error('Offer unavailable');
    if (offer.userId === user.id) throw new Error('Cannot take your own offer');
    if (ghs < Number(offer.minGHS) || ghs > Number(offer.maxGHS)) {
      throw new Error(`Amount must be between GHS ${offer.minGHS} and GHS ${offer.maxGHS}`);
    }
    const amountAsset = ghs / Number(offer.priceGHS);
    if (amountAsset > Number(offer.available)) throw new Error('Offer has insufficient volume');

    // If maker SELLs crypto: maker is the seller, taker is the buyer (pays GHS off-platform).
    const sellerId = offer.side === 'SELL' ? offer.userId : user.id;
    const buyerId = offer.side === 'SELL' ? user.id : offer.userId;

    const order = await prisma.$transaction(async (db) => {
      await lockFunds(db, sellerId, offer.asset, amountAsset); // escrow
      await db.p2POffer.update({
        where: { id: offer.id },
        data: { available: { decrement: amountAsset } },
      });
      return db.p2POrder.create({
        data: {
          offerId: offer.id,
          buyerId,
          sellerId,
          asset: offer.asset,
          amount: amountAsset,
          priceGHS: offer.priceGHS,
          totalGHS: ghs,
          status: 'PENDING_PAYMENT',
          expiresAt: new Date(Date.now() + settings.expiryMinutes * 60 * 1000),
        },
      });
    });

    // CediX Automated Payment Assistant opens the order conversation.
    if (settings.assistantEnabled && buyerId === user.id) {
      const offerTerms = offer.terms ? `${offer.terms}\n\nThis is an automated message` : null;
      if (offerTerms) await addP2PChat(order.id, 'SELLER', offerTerms, { kind: 'terms', automated: true }).catch(() => {});
      await addP2PChat(
        order.id,
        'ASSISTANT',
        'Welcome to CediX P2P. Your order is ready. For your security, payments are accepted only through the official payment checkout provided in this conversation.',
        { kind: 'welcome' }
      ).catch(() => {});
      await addP2PChat(order.id, 'ASSISTANT', 'Which network would you like to use?', {
        kind: 'choose-network',
        options: ['MTN Mobile Money', 'Telecel Cash'],
      }).catch(() => {});
    }

    return { order: { ...order, orderNo: orderNumber(order) } };
  });
}
