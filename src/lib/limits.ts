// Admin-configurable transaction limits (USD-denominated, Settings-backed).
import { prisma } from './db';

export type Limits = { minDepositUSD: number; minWithdrawalUSD: number };

const DEFAULTS: Limits = { minDepositUSD: 50, minWithdrawalUSD: 150 };

export async function getLimits(): Promise<Limits> {
  const rows = await prisma.setting.findMany({ where: { key: { in: ['min_deposit_usd', 'min_withdrawal_usd'] } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const num = (k: string, d: number) => (typeof map.get(k) === 'number' && (map.get(k) as number) >= 0 ? (map.get(k) as number) : d);
  return {
    minDepositUSD: num('min_deposit_usd', DEFAULTS.minDepositUSD),
    minWithdrawalUSD: num('min_withdrawal_usd', DEFAULTS.minWithdrawalUSD),
  };
}
