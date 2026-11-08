import { prisma } from './db';
import { getBaseAssetPrice } from './markets';
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
};

export type Portfolio = {
  assets: PortfolioAsset[];
  totalUSD: number;
  totalGHS: number;
  ghsPerUsd: number;
};

export async function getPortfolio(userId: string): Promise<Portfolio> {
  const [wallets, fx] = await Promise.all([
    prisma.wallet.findMany({ where: { userId } }),
    getFx(),
  ]);

  const assets: PortfolioAsset[] = [];
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
    assets.push({
      asset: w.asset,
      available,
      locked,
      total,
      priceUSD,
      valueUSD,
      valueGHS: valueUSD * fx.rate,
    });
  }
  assets.sort((a, b) => b.valueUSD - a.valueUSD);
  const totalUSD = assets.reduce((s, a) => s + a.valueUSD, 0);
  return { assets, totalUSD, totalGHS: totalUSD * fx.rate, ghsPerUsd: fx.rate };
}
