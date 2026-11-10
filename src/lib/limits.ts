// Admin-configurable transaction limits (USD-denominated, Settings-backed).
import { prisma } from './db';

export type Limits = {
  minDepositUSD: number;
  minWithdrawalUSD: number;
  /** Disclosed anti-abuse gate: completed real purchases required before a
   * withdrawal request is accepted. 0 = off (does not trap deposits). */
  withdrawMinPurchases: number;
};

const DEFAULTS: Limits = { minDepositUSD: 50, minWithdrawalUSD: 200, withdrawMinPurchases: 0 };

export async function getLimits(): Promise<Limits> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['min_deposit_usd', 'min_withdrawal_usd', 'withdraw_min_purchases'] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const num = (k: string, d: number) => (typeof map.get(k) === 'number' && (map.get(k) as number) >= 0 ? (map.get(k) as number) : d);
  return {
    minDepositUSD: num('min_deposit_usd', DEFAULTS.minDepositUSD),
    minWithdrawalUSD: num('min_withdrawal_usd', DEFAULTS.minWithdrawalUSD),
    withdrawMinPurchases: Math.floor(num('withdraw_min_purchases', DEFAULTS.withdrawMinPurchases)),
  };
}

/** Count a user's genuinely completed purchases (FILLED buy orders only).
 * Cancelled, failed or open orders never count. */
export async function completedPurchaseCount(userId: string): Promise<number> {
  return prisma.order.count({ where: { userId, side: 'BUY', status: 'FILLED' } });
}

