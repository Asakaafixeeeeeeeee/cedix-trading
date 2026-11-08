import { api } from '@/lib/api';

// Market overview: real quotes + 1-month sparklines from Yahoo Finance's
// public chart API. Information only — these instruments are not tradable on
// CediX. Cached 10 minutes; reports available:false when the feed is down.

const INSTRUMENTS = [
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF' },
  { symbol: 'SPY', name: 'S&P 500 ETF' },
  { symbol: 'GLD', name: 'Gold ETF' },
  { symbol: 'BTC-USD', name: 'Bitcoin' },
];

type Card = { symbol: string; name: string; price: number; changePct: number; spark: number[] };
let cache: { data: { available: boolean; cards: Card[] }; at: number } | null = null;
const TTL = 10 * 60 * 1000;

async function fetchCard(symbol: string, name: string): Promise<Card | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;
    const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter((c: number | null) => c != null) as number[];
    const price = meta?.regularMarketPrice;
    const prev = meta?.chartPreviousClose ?? closes[closes.length - 2];
    if (!price || closes.length < 2) return null;
    const last = closes[closes.length - 2]; // previous session close
    const changePct = last ? ((price - last) / last) * 100 : prev ? ((price - prev) / prev) * 100 : 0;
    return { symbol, name, price, changePct, spark: closes.slice(-30) };
  } catch {
    return null;
  }
}

export async function GET() {
  return api(async () => {
    if (cache && Date.now() - cache.at < TTL) return cache.data;
    const cards = (await Promise.all(INSTRUMENTS.map((i) => fetchCard(i.symbol, i.name)))).filter(
      (c): c is Card => c !== null,
    );
    const data = { available: cards.length > 0, cards };
    if (data.available) cache = { data, at: Date.now() };
    return cache?.data ?? data;
  });
}
