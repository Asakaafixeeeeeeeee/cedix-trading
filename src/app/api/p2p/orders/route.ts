import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { lockFunds } from '@/lib/wallet';
import { api } from '@/lib/api';

export async function GET() {
  return api(async () => {
    const user = await requireUser();
    const orders = await prisma.p2POrder.findMany({
      where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
      include: {
        offer: true,
        buyer: { select: { username: true } },
        seller: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { orders, myId: user.id };
  });
}

/** Take a P2P offer. Crypto escrow is locked from the seller. */
export async function POST(req: Request) {
  return api(async () => {
    const user = await requireUser();
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
        },
      });
    });
    return { order };
  });
}
