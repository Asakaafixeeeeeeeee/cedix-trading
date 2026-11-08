import { getFx } from '@/lib/fx';
import { getBaseAssetPrice } from '@/lib/markets';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

/** Preview: crypto quantity → GHS payout after fees (no sale step needed). */
export async function GET(req: Request) {
  return api(async () => {
    const url = new URL(req.url);
    const asset = url.searchParams.get('asset') ?? 'USDT';
    const amountAsset = parseFloat(url.searchParams.get('amount') ?? '0');
    const fx = await getFx();
    const assetPrice = asset === 'GHS' ? 1 / fx.rate : await getBaseAssetPrice(asset);
    if (!assetPrice) throw new Error('Unsupported asset');
    const feeRow = await prisma.setting.findUnique({ where: { key: 'withdrawal_fee_pct' } });
    const feePct = typeof feeRow?.value === 'number' ? feeRow.value : 1;
    const amountUSD = amountAsset * assetPrice;
    const grossGHS = amountUSD * fx.rate;
    const feeGHS = grossGHS * (feePct / 100);
    return {
      asset,
      amountAsset,
      amountUSD,
      grossGHS,
      feeGHS,
      netGHS: grossGHS - feeGHS,
      feePct,
      rateGHSUSD: fx.rate,
      assetPriceUSD: assetPrice,
    };
  });
}
