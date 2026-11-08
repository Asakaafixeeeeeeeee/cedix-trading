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
    // GHS = fiat wallet deposit (1 GHS); crypto priced live
    const assetPrice = asset === 'GHS' ? 1 / fx.rate : await getBaseAssetPrice(asset);
    if (!assetPrice) throw new Error('Live price unavailable for this asset — please try again in a moment');
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
