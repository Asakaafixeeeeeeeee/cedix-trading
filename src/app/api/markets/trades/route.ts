import { getRecentTrades } from '@/lib/markets';
import { api } from '@/lib/api';

export async function GET(req: Request) {
  return api(async () => {
    const url = new URL(req.url);
    const symbol = url.searchParams.get('symbol') ?? 'BTCUSDT';
    return { trades: await getRecentTrades(symbol, 30) };
  });
}
