import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getFx } from '@/lib/fx';
import { getBaseAssetPrice } from '@/lib/markets';
import { createPayment } from '@/lib/payteller';
import { getLimits } from '@/lib/limits';
import { api } from '@/lib/api';

export async function GET() {
  return api(async () => {
    const user = await requireUser();
    const deposits = await prisma.depositIntent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return { deposits };
  });
}

/** Start a GHS → crypto deposit through Payteller. */
export async function POST(req: Request) {
  return api(async () => {
    const user = await requireUser();
    const { asset, amountGHS, method, payerPhone } = await req.json();
    const amt = Number(amountGHS);
    if (!(amt > 0)) throw new Error('Enter a deposit amount');
    if (amt > 500000) throw new Error('Maximum deposit is GHS 500,000');
    const fiatMethod = ['MOMO', 'CARD', 'BANK'].includes(method) ? method : 'MOMO';

    const fx = await getFx();
    const limits = await getLimits();
    const minGHS = limits.minDepositUSD * fx.rate;
    if (amt / fx.rate < limits.minDepositUSD - 1e-9) {
      throw new Error(`Minimum deposit is $${limits.minDepositUSD.toFixed(2)} (≈ GH₵${minGHS.toFixed(2)})`);
    }
    // GHS = fiat wallet deposit (1 GHS); crypto priced live
    const assetPrice = asset === 'GHS' ? 1 / fx.rate : await getBaseAssetPrice(asset);
    if (!assetPrice) throw new Error('Live price unavailable for this asset — please try again in a moment');
    const amountUSD = amt / fx.rate;
    const amountAsset = amountUSD / assetPrice;

    const intent = await prisma.depositIntent.create({
      data: {
        userId: user.id,
        asset,
        amountGHS: amt,
        amountUSD,
        amountAsset,
        rateGHSUSD: fx.rate,
        assetPrice,
        method: fiatMethod,
        payerPhone: payerPhone || null,
        status: 'INITIATED',
      },
    });

    // Public origin (Render terminates TLS at the proxy, so req.url can carry
    // the wrong protocol/port — Payteller requires a clean public HTTPS URL).
    const rawHost = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').split(',')[0].trim().replace(/:\d+$/, '');
    const isLocal = !rawHost || rawHost === 'localhost' || rawHost.startsWith('127.') || rawHost.startsWith('192.168.');
    const payment = await createPayment({
      reference: intent.id,
      amountGHS: amt,
      customerEmail: user.email,
      description: `CediX deposit - ${amountAsset.toFixed(8)} ${asset}`,
      // Customer returns here after checkout records an outcome. Returning is
      // NEVER proof of payment — the page only polls our verified status.
      returnUrl: isLocal ? undefined : `https://${rawHost}/m/deposit/status/${intent.id}`,
    });

    await prisma.depositIntent.update({
      where: { id: intent.id },
      data: { status: 'AWAITING_PAYMENT', gatewayRef: payment.gatewayRef },
    });

    return { id: intent.id, checkoutUrl: payment.checkoutUrl };
  });
}
