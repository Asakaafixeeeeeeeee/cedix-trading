// MT5-style spot positions derived from REAL trade history.
// A "position" is your current holding of a base asset, with an average entry
// price (cost basis) computed from your actual FILLED buy/sell trades. P/L is
// unrealised and updates purely from live market prices — never fabricated.

import { prisma } from './db';
import { assetMeta, getBaseAssetPrice, CRYPTO_ASSETS } from './markets';

export type Position = {
  asset: string;
  symbol: string;
  name: string;
  quantity: number; // current holding (from wallet)
  entryPrice: number; // average cost basis (USDT per unit)
  currentPrice: number;
  invested: number; // quantity * entryPrice
  currentValue: number; // quantity * currentPrice
  pnl: number; // currentValue - invested
  pnlPct: number;
  realisedPnl: number; // locked-in P/L from past sells
};

/** Average-cost basis per base asset from the user's chronological trades. */
export async function getPositions(userId: string): Promise<Position[]> {
  const [trades, wallets] = await Promise.all([
    prisma.trade.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.wallet.findMany({ where: { userId } }),
  ]);

  // Running average cost per base asset.
  type Acc = { qty: number; cost: number; realised: number };
  const acc = new Map<string, Acc>();
  for (const t of trades) {
    const meta = assetMeta(t.symbol);
    if (!meta) continue;
    const base = meta.base;
    const a = acc.get(base) ?? { qty: 0, cost: 0, realised: 0 };
    const qty = Number(t.quantity);
    const price = Number(t.price);
    if (t.side === 'BUY') {
      a.qty += qty;
      a.cost += qty * price;
    } else {
      // SELL: realise P/L against current average cost, reduce basis proportionally
      const avg = a.qty > 0 ? a.cost / a.qty : 0;
      const sellQty = Math.min(qty, a.qty);
      a.realised += (price - avg) * sellQty;
      a.cost -= avg * sellQty;
      a.qty -= sellQty;
      if (a.qty < 1e-12) {
        a.qty = 0;
        a.cost = 0;
      }
    }
    acc.set(base, a);
  }

  const positions: Position[] = [];
  for (const w of wallets) {
    if (w.asset === 'GHS' || w.asset === 'USDT' || w.asset === 'USDC') continue;
    const held = Number(w.available) + Number(w.locked);
    const a = acc.get(w.asset);
    if (held <= 1e-12 && !(a && a.realised !== 0)) continue;
    const meta = CRYPTO_ASSETS.find((m) => m.base === w.asset);
    const entryPrice = a && a.qty > 1e-12 ? a.cost / a.qty : 0;
    const currentPrice = (await getBaseAssetPrice(w.asset)) ?? 0;
    const invested = held * entryPrice;
    const currentValue = held * currentPrice;
    const pnl = currentValue - invested;
    positions.push({
      asset: w.asset,
      symbol: meta?.symbol ?? `${w.asset}USDT`,
      name: meta?.name ?? w.asset,
      quantity: held,
      entryPrice,
      currentPrice,
      invested,
      currentValue,
      pnl,
      pnlPct: invested > 0 ? (pnl / invested) * 100 : 0,
      realisedPnl: a?.realised ?? 0,
    });
  }

  positions.sort((p1, p2) => p2.currentValue - p1.currentValue);
  return positions;
}
