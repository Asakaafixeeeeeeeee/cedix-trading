import { getFx } from '@/lib/fx';
import { getBaseAssetPrice } from '@/lib/markets';
import { api } from '@/lib/api';

/** Conversion preview: GHS amount → crypto quantity at current rates. */
export async function GET(req: Request) {
  return api(async () => {
    const url = new URL(req.url);
    const asset = url.searchParams.get('asset') ?? 'USDT';
    const amountGHS = parseFloat(url.searchParams.get('amountGHS') ?? '0');
    const fx = await getFx();
    const assetPrice = await getBaseAssetPrice(asset);
    if (!assetPrice) throw new Error('Unsupported asset');
    const amountUSD = amountGHS / fx.rate;
    const amountAsset = amountUSD / assetPrice;
    return {
      asset,
      amountGHS,
      amountUSD,
      amountAsset,
      rateGHSUSD: fx.rate,
      assetPriceUSD: assetPrice,
      fxSource: fx.source,
    };
  });
}
