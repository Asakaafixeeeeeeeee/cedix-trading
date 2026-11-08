import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getFx } from '@/lib/fx';
import { getBaseAssetPrice } from '@/lib/markets';
import { createCollection } from '@/lib/payteller';
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
    if (!(amt >= 10)) throw new Error('Minimum deposit is GHS 10');
    if (amt > 500000) throw new Error('Maximum deposit is GHS 500,000');
    const fiatMethod = ['MOMO', 'CARD', 'BANK'].includes(method) ? method : 'MOMO';

    const fx = await getFx();
    const assetPrice = await getBaseAssetPrice(asset);
    if (!assetPrice) throw new Error('Unsupported asset');
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

    const origin = new URL(req.url).origin;
    const collection = await createCollection({
      reference: intent.id,
      amountGHS: amt,
      method: fiatMethod,
      payerPhone,
      description: `CediX deposit: ${amountAsset.toFixed(8)} ${asset}`,
      callbackUrl: `${origin}/api/payteller/webhook`,
    });

    await prisma.depositIntent.update({
      where: { id: intent.id },
      data: { status: 'AWAITING_PAYMENT', gatewayRef: collection.gatewayRef },
    });

    return { id: intent.id, checkoutUrl: collection.checkoutUrl };
  });
}
