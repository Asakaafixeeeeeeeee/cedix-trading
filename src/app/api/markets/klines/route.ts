import { getKlines } from '@/lib/markets';
import { api } from '@/lib/api';

export async function GET(req: Request) {
  return api(async () => {
    const url = new URL(req.url);
    const symbol = url.searchParams.get('symbol') ?? 'BTCUSDT';
    const interval = url.searchParams.get('interval') ?? '1h';
    const limit = Math.min(1000, parseInt(url.searchParams.get('limit') ?? '300', 10));
    return { klines: await getKlines(symbol, interval, limit) };
  });
}
