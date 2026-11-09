import { api } from '@/lib/api';
import { getLimits } from '@/lib/limits';
import { getFx } from '@/lib/fx';

/** Public transaction limits + current rate, shown before users initiate transactions. */
export async function GET() {
  return api(async () => {
    const [limits, fx] = await Promise.all([getLimits(), getFx()]);
    return {
      minDepositUSD: limits.minDepositUSD,
      minWithdrawalUSD: limits.minWithdrawalUSD,
      minDepositGHS: +(limits.minDepositUSD * fx.rate).toFixed(2),
      minWithdrawalGHS: +(limits.minWithdrawalUSD * fx.rate).toFixed(2),
      rateGHSUSD: fx.rate,
    };
  });
}
