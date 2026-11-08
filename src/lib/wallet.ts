import { prisma } from './db';
import { getBaseAssetPrice, getSpotTickers, metaForBase } from './markets';
import { getFx } from './fx';
import type { Prisma } from '@/generated/prisma/client';

type Tx = Prisma.TransactionClient;

export async function getOrCreateWallet(db: Tx, userId: string, asset: string) {
  return db.wallet.upsert({
    where: { userId_asset: { userId, asset } },
    update: {},
    create: { userId, asset },
  });
}

export async function credit(db: Tx, userId: string, asset: string, amount: number) {
  if (amount < 0) throw new Error('credit amount must be positive');
  await getOrCreateWallet(db, userId, asset);
  await db.wallet.update({
    where: { userId_asset: { userId, asset } },
    data: { available: { increment: amount } },
  });
}

export async function debit(db: Tx, userId: string, asset: string, amount: number) {
  if (amount < 0) throw new Error('debit amount must be positive');
  const w = await getOrCreateWallet(db, userId, asset);
  if (Number(w.available) < amount - 1e-12) {
    throw new Error(`Insufficient ${asset} balance`);
  }
  await db.wallet.update({
    where: { userId_asset: { userId, asset } },
    data: { available: { decrement: amount } },
  });
}

export async function lockFunds(db: Tx, userId: string, asset: string, amount: number) {
  const w = await getOrCreateWallet(db, userId, asset);
  if (Number(w.available) < amount - 1e-12) throw new Error(`Insufficient ${asset} balance`);
  await db.wallet.update({
    where: { userId_asset: { userId, asset } },
    data: { available: { decrement: amount }, locked: { increment: amount } },
  });
}

export async function unlockFunds(db: Tx, userId: string, asset: string, amount: number) {
  await db.wallet.update({
    where: { userId_asset: { userId, asset } },
    data: { available: { increment: amount }, locked: { decrement: amount } },
  });
}

/** Spend from locked balance (e.g. when a locked order fills). */
export async function spendLocked(db: Tx, userId: string, asset: string, amount: number) {
  await db.wallet.update({
    where: { userId_asset: { userId, asset } },
    data: { locked: { decrement: amount } },
  });
}

export type PortfolioAsset = {
  asset: string;
  available: number;
  locked: number;
  total: number;
  priceUSD: number;
  valueUSD: number;
  valueGHS: number;
  /** 24h market change of this asset (%) */
  changePct: number;
  /** 24h value change of the holding (USD), derived from live market data */
  pnl24hUSD: number;
};

export type Portfolio = {
  assets: PortfolioAsset[];
  totalUSD: number;
  totalGHS: number;
  ghsPerUsd: number;
  /** Buckets (USD): fiat funding wallet, spot trading wallet, earn positions */
  fundingUSD: number;
  tradingUSD: number;
  earnUSD: number;
  /** Today's PnL across holdings (USD + %) based on live 24h market moves */
  pnl24hUSD: number;
  pnl24hPct: number;
};

export async function getPortfolio(userId: string): Promise<Portfolio> {
  const [wallets, fx, tickers, positions] = await Promise.all([
    prisma.wallet.findMany({ where: { userId } }),
    getFx(),
    getSpotTickers().catch(() => []),
    prisma.position.findMany({ where: { userId, status: 'ACTIVE' }, include: { product: true } }),
  ]);

  const changeBySymbol = new Map(tickers.map((t) => [t.symbol, t.changePct]));

  const assets: PortfolioAsset[] = [];
  let fundingUSD = 0;
  let tradingUSD = 0;

  for (const w of wallets) {
    const available = Number(w.available);
    const locked = Number(w.locked);
    const total = available + locked;
    if (total <= 0) continue;
    let priceUSD: number;
    if (w.asset === 'GHS') {
      priceUSD = 1 / fx.rate;
    } else {
      priceUSD = (await getBaseAssetPrice(w.asset)) ?? 0;
    }
    const valueUSD = total * priceUSD;
    const meta = metaForBase(w.asset);
    const changePct = w.asset === 'GHS' || w.asset === 'USDT' || w.asset === 'USDC' ? 0 : (meta ? changeBySymbol.get(meta.symbol) ?? 0 : 0);
    // value now vs value 24h ago for the same quantity
    const pnl24hUSD = changePct !== 0 ? valueUSD - valueUSD / (1 + changePct / 100) : 0;
    if (w.asset === 'GHS') fundingUSD += valueUSD;
    else tradingUSD += valueUSD;
    assets.push({
      asset: w.asset,
      available,
      locked,
      total,
      priceUSD,
      valueUSD,
      valueGHS: valueUSD * fx.rate,
      changePct,
      pnl24hUSD,
    });
  }
  assets.sort((a, b) => b.valueUSD - a.valueUSD);

  let earnUSD = 0;
  for (const pos of positions) {
    const amount = Number(pos.amount) + Number(pos.accrued);
    const price =
      pos.product.asset === 'GHS' ? 1 / fx.rate : (await getBaseAssetPrice(pos.product.asset)) ?? 0;
    earnUSD += amount * price;
  }

  const totalUSD = fundingUSD + tradingUSD + earnUSD;
  const pnl24hUSD = assets.reduce((s, a) => s + a.pnl24hUSD, 0);
  const base = totalUSD - pnl24hUSD;
  return {
    assets,
    totalUSD,
    totalGHS: totalUSD * fx.rate,
    ghsPerUsd: fx.rate,
    fundingUSD,
    tradingUSD,
    earnUSD,
    pnl24hUSD,
    pnl24hPct: base > 0 ? (pnl24hUSD / base) * 100 : 0,
  };
}
