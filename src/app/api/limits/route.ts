import { api } from '@/lib/api';
import { getLimits, completedPurchaseCount } from '@/lib/limits';
import { getFx } from '@/lib/fx';
import { getCurrentUser } from '@/lib/auth';

/** Public transaction limits + current rate, shown before users initiate transactions. */
export async function GET() {
  return api(async () => {
    const [limits, fx, user] = await Promise.all([getLimits(), getFx(), getCurrentUser()]);
    const purchases = user ? await completedPurchaseCount(user.id) : 0;
    return {
      minDepositUSD: limits.minDepositUSD,
      minWithdrawalUSD: limits.minWithdrawalUSD,
      minDepositGHS: +(limits.minDepositUSD * fx.rate).toFixed(2),
      minWithdrawalGHS: +(limits.minWithdrawalUSD * fx.rate).toFixed(2),
      withdrawMinPurchases: limits.withdrawMinPurchases,
      completedPurchases: purchases,
      rateGHSUSD: fx.rate,
    };
  });
}
