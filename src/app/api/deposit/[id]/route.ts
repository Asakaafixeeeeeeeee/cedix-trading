import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';
import { settleDeposit } from '@/lib/deposits';
import { isSuccessStatus, paytellerConfig, paytellerMode, verifyPayment } from '@/lib/payteller';

const OPEN = ['INITIATED', 'AWAITING_PAYMENT', 'PROCESSING'];

// Per-intent throttle so client polling never hits Payteller faster than
// its documented 5-second minimum, even with multiple open tabs.
const lastChecked = new Map<string, number>();

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    let deposit = await prisma.depositIntent.findUnique({ where: { id } });
    if (!deposit || deposit.userId !== user.id) throw new Error('Deposit not found');

    // Reconciliation for delayed webhooks: while the deposit is open, check
    // the authoritative Payteller verification API and settle through the
    // same exactly-once path the webhook uses. The browser never decides.
    if (
      paytellerMode() === 'live' &&
      OPEN.includes(deposit.status) &&
      deposit.gatewayRef &&
      Date.now() - (lastChecked.get(id) ?? 0) > 5000
    ) {
      lastChecked.set(id, Date.now());
      try {
        const v = await verifyPayment(deposit.gatewayRef);
        if (v && v.reference === deposit.id && v.currency === 'GHS' && v.environment === paytellerConfig().expectedEnvironment) {
          const amountOk = Math.abs(Number(v.amount) - Number(deposit.amountGHS)) < 0.005;
          if (isSuccessStatus(v.status) && amountOk) {
            await settleDeposit(deposit.id, 'successful', { providerRef: v.provider_reference ?? null });
          } else if (v.status === 'failed') {
            await settleDeposit(deposit.id, 'failed');
          }
          deposit = (await prisma.depositIntent.findUnique({ where: { id } })) ?? deposit;
        }
      } catch {
        // Gateway temporarily unreachable — report the stored status.
      }
    }

    return { deposit };
  });
}
