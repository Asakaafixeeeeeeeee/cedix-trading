import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

/** Public platform configuration (fees) for display in trading UIs. */
export async function GET() {
  return api(async () => {
    const rows = await prisma.setting.findMany({
      where: { key: { in: ['trading_fee_pct', 'withdrawal_fee_pct'] } },
    });
    const get = (k: string, d: number) => {
      const v = rows.find((r) => r.key === k)?.value;
      return typeof v === 'number' ? v : d;
    };
    return {
      tradingFeePct: get('trading_fee_pct', 0.1),
      withdrawalFeePct: get('withdrawal_fee_pct', 1),
    };
  });
}
