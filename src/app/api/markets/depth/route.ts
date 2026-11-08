import { getDepth } from '@/lib/markets';
import { api } from '@/lib/api';

export async function GET(req: Request) {
  return api(async () => {
    const url = new URL(req.url);
    const symbol = url.searchParams.get('symbol') ?? 'BTCUSDT';
    const limit = Math.min(50, parseInt(url.searchParams.get('limit') ?? '20', 10));
    return await getDepth(symbol, limit);
  });
}
