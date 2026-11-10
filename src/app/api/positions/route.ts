import { requireUser } from '@/lib/auth';
import { getPositions } from '@/lib/positions';
import { getFx } from '@/lib/fx';
import { api } from '@/lib/api';

/** MT5-style open spot positions with live, honest P/L. */
export async function GET() {
  return api(async () => {
    const user = await requireUser();
    const [positions, fx] = await Promise.all([getPositions(user.id), getFx()]);
    const totalValue = positions.reduce((s, p) => s + p.currentValue, 0);
    const totalInvested = positions.reduce((s, p) => s + p.invested, 0);
    const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
    return {
      positions,
      summary: {
        totalValue,
        totalInvested,
        totalPnl,
        totalPnlPct: totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0,
        ghsPerUsd: fx.rate,
      },
    };
  });
}
