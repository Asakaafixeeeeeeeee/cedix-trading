import { getSpotTickers, getFuturesTickers, ALL_ASSETS } from '@/lib/markets';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  return api(async () => {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') === 'futures' ? 'futures' : 'spot';
    const tickers = type === 'futures' ? await getFuturesTickers() : await getSpotTickers();

    const session = await getSession();
    let favorites: string[] = [];
    if (session) {
      const favs = await prisma.favorite.findMany({ where: { userId: session.sub } });
      favorites = favs.map((f) => f.symbol);
    }

    const byName = new Map(tickers.map((t) => [t.symbol, t]));
    const rows = ALL_ASSETS.flatMap((a) => {
      const t = byName.get(a.symbol);
      if (!t) return [];
      return [{
        ...a,
        price: t.price,
        changePct: t.changePct,
        high: t.high,
        low: t.low,
        volume: t.volume,
        quoteVolume: t.quoteVolume,
        favorite: favorites.includes(a.symbol),
      }];
    });
    return { type, markets: rows };
  });
}
