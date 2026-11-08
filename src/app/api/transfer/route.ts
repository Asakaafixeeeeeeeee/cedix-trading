import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getFx } from '@/lib/fx';
import { credit, debit } from '@/lib/wallet';
import { api } from '@/lib/api';

/**
 * Transfer / convert between the Funding wallet (GHS) and the Trading wallet (USDT)
 * at the live exchange rate, with no fee.
 */
export async function POST(req: Request) {
  return api(async () => {
    const user = await requireUser();
    const { direction, amount } = await req.json();
    const amt = Number(amount);
    if (!(amt > 0)) throw new Error('Amount must be positive');
    if (!['GHS_TO_USDT', 'USDT_TO_GHS'].includes(direction)) throw new Error('Invalid direction');

    const fx = await getFx();

    if (direction === 'GHS_TO_USDT') {
      const usdt = amt / fx.rate;
      await prisma.$transaction(async (db) => {
        await debit(db, user.id, 'GHS', amt);
        await credit(db, user.id, 'USDT', usdt);
        await db.transaction.create({
          data: {
            userId: user.id,
            type: 'TRADE_BUY',
            asset: 'USDT',
            amount: usdt,
            note: `Transfer: GH₵${amt.toFixed(2)} → ${usdt.toFixed(2)} USDT @ ${fx.rate.toFixed(4)}`,
            meta: { kind: 'transfer', direction, rate: fx.rate },
          },
        });
      });
      return { received: usdt, asset: 'USDT', rate: fx.rate };
    }

    const ghs = amt * fx.rate;
    await prisma.$transaction(async (db) => {
      await debit(db, user.id, 'USDT', amt);
      await credit(db, user.id, 'GHS', ghs);
      await db.transaction.create({
        data: {
          userId: user.id,
          type: 'TRADE_SELL',
          asset: 'USDT',
          amount: amt,
          note: `Transfer: ${amt.toFixed(2)} USDT → GH₵${ghs.toFixed(2)} @ ${fx.rate.toFixed(4)}`,
          meta: { kind: 'transfer', direction, rate: fx.rate },
        },
      });
    });
    return { received: ghs, asset: 'GHS', rate: fx.rate };
  });
}
