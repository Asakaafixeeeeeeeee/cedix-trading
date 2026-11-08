// Market data: live crypto via Binance public API, tokenized stocks/ETFs simulated.

export type AssetMeta = {
  symbol: string; // trading symbol e.g. BTCUSDT
  base: string; // BTC
  quote: string; // USDT
  name: string;
  category: 'crypto' | 'new' | 'stock' | 'etf';
  color: string;
  precision: number; // price display decimals
  qtyPrecision: number;
};

export const CRYPTO_ASSETS: AssetMeta[] = [
  { symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT', name: 'Bitcoin', category: 'crypto', color: '#F7931A', precision: 2, qtyPrecision: 6 },
  { symbol: 'ETHUSDT', base: 'ETH', quote: 'USDT', name: 'Ethereum', category: 'crypto', color: '#627EEA', precision: 2, qtyPrecision: 5 },
  { symbol: 'SOLUSDT', base: 'SOL', quote: 'USDT', name: 'Solana', category: 'crypto', color: '#9945FF', precision: 2, qtyPrecision: 3 },
  { symbol: 'BNBUSDT', base: 'BNB', quote: 'USDT', name: 'BNB', category: 'crypto', color: '#F3BA2F', precision: 2, qtyPrecision: 4 },
  { symbol: 'XRPUSDT', base: 'XRP', quote: 'USDT', name: 'XRP', category: 'crypto', color: '#23292F', precision: 4, qtyPrecision: 1 },
  { symbol: 'ADAUSDT', base: 'ADA', quote: 'USDT', name: 'Cardano', category: 'crypto', color: '#0033AD', precision: 4, qtyPrecision: 1 },
  { symbol: 'DOGEUSDT', base: 'DOGE', quote: 'USDT', name: 'Dogecoin', category: 'crypto', color: '#C2A633', precision: 5, qtyPrecision: 0 },
  { symbol: 'DOTUSDT', base: 'DOT', quote: 'USDT', name: 'Polkadot', category: 'crypto', color: '#E6007A', precision: 3, qtyPrecision: 2 },
  { symbol: 'MATICUSDT', base: 'MATIC', quote: 'USDT', name: 'Polygon', category: 'crypto', color: '#8247E5', precision: 4, qtyPrecision: 1 },
  { symbol: 'LTCUSDT', base: 'LTC', quote: 'USDT', name: 'Litecoin', category: 'crypto', color: '#345D9D', precision: 2, qtyPrecision: 3 },
  { symbol: 'AVAXUSDT', base: 'AVAX', quote: 'USDT', name: 'Avalanche', category: 'crypto', color: '#E84142', precision: 2, qtyPrecision: 2 },
  { symbol: 'LINKUSDT', base: 'LINK', quote: 'USDT', name: 'Chainlink', category: 'crypto', color: '#2A5ADA', precision: 3, qtyPrecision: 2 },
  { symbol: 'TRXUSDT', base: 'TRX', quote: 'USDT', name: 'TRON', category: 'crypto', color: '#EF0027', precision: 5, qtyPrecision: 0 },
  { symbol: 'SHIBUSDT', base: 'SHIB', quote: 'USDT', name: 'Shiba Inu', category: 'crypto', color: '#FFA409', precision: 8, qtyPrecision: 0 },
  // "New" listings tab
  { symbol: 'SUIUSDT', base: 'SUI', quote: 'USDT', name: 'Sui', category: 'new', color: '#4DA2FF', precision: 4, qtyPrecision: 1 },
  { symbol: 'SEIUSDT', base: 'SEI', quote: 'USDT', name: 'Sei', category: 'new', color: '#9E1F19', precision: 4, qtyPrecision: 1 },
  { symbol: 'JUPUSDT', base: 'JUP', quote: 'USDT', name: 'Jupiter', category: 'new', color: '#14F195', precision: 4, qtyPrecision: 1 },
  { symbol: 'WIFUSDT', base: 'WIF', quote: 'USDT', name: 'dogwifhat', category: 'new', color: '#B59AFF', precision: 4, qtyPrecision: 1 },
  { symbol: 'ARBUSDT', base: 'ARB', quote: 'USDT', name: 'Arbitrum', category: 'new', color: '#28A0F0', precision: 4, qtyPrecision: 1 },
  { symbol: 'OPUSDT', base: 'OP', quote: 'USDT', name: 'Optimism', category: 'new', color: '#FF0420', precision: 4, qtyPrecision: 1 },
];

// Tokenized stocks & ETFs — simulated prices (demo until a stock data provider is configured)
export type SimAsset = AssetMeta & { basePrice: number };
export const SIM_ASSETS: SimAsset[] = [
  { symbol: 'AAPLX', base: 'AAPL', quote: 'USDT', name: 'Apple (Tokenized)', category: 'stock', color: '#A2AAAD', precision: 2, qtyPrecision: 2, basePrice: 272.4 },
  { symbol: 'TSLAX', base: 'TSLA', quote: 'USDT', name: 'Tesla (Tokenized)', category: 'stock', color: '#CC0000', precision: 2, qtyPrecision: 2, basePrice: 448.9 },
  { symbol: 'NVDAX', base: 'NVDA', quote: 'USDT', name: 'NVIDIA (Tokenized)', category: 'stock', color: '#76B900', precision: 2, qtyPrecision: 2, basePrice: 188.2 },
  { symbol: 'MSFTX', base: 'MSFT', quote: 'USDT', name: 'Microsoft (Tokenized)', category: 'stock', color: '#00A4EF', precision: 2, qtyPrecision: 2, basePrice: 508.3 },
  { symbol: 'AMZNX', base: 'AMZN', quote: 'USDT', name: 'Amazon (Tokenized)', category: 'stock', color: '#FF9900', precision: 2, qtyPrecision: 2, basePrice: 244.1 },
  { symbol: 'SPYX', base: 'SPY', quote: 'USDT', name: 'S&P 500 ETF (Tokenized)', category: 'etf', color: '#1F6FEB', precision: 2, qtyPrecision: 2, basePrice: 682.5 },
  { symbol: 'QQQX', base: 'QQQ', quote: 'USDT', name: 'Nasdaq 100 ETF (Tokenized)', category: 'etf', color: '#58A6FF', precision: 2, qtyPrecision: 2, basePrice: 622.7 },
  { symbol: 'GLDX', base: 'GLD', quote: 'USDT', name: 'Gold ETF (Tokenized)', category: 'etf', color: '#D4AF37', precision: 2, qtyPrecision: 2, basePrice: 389.6 },
];

export const ALL_ASSETS: AssetMeta[] = [...CRYPTO_ASSETS, ...SIM_ASSETS];

export function assetMeta(symbol: string): AssetMeta | undefined {
  return ALL_ASSETS.find((a) => a.symbol === symbol);
}

export function metaForBase(base: string): AssetMeta | undefined {
  return ALL_ASSETS.find((a) => a.base === base);
}

export type Ticker = {
  symbol: string;
  price: number;
  changePct: number;
  high: number;
  low: number;
  volume: number; // base volume
  quoteVolume: number;
};

const BINANCE = 'https://api.binance.com';
const BINANCE_F = 'https://fapi.binance.com';

let spotCache: { data: Ticker[]; at: number } | null = null;
let futCache: { data: Ticker[]; at: number } | null = null;
const TICKER_TTL = 5000;

function parse24h(t: Record<string, string>): Ticker {
  return {
    symbol: t.symbol,
    price: parseFloat(t.lastPrice),
    changePct: parseFloat(t.priceChangePercent),
    high: parseFloat(t.highPrice),
    low: parseFloat(t.lowPrice),
    volume: parseFloat(t.volume),
    quoteVolume: parseFloat(t.quoteVolume),
  };
}

/** Deterministic pseudo-random walk for simulated stock/ETF prices. */
function simTicker(a: SimAsset): Ticker {
  const t = Math.floor(Date.now() / 15000); // step every 15s
  const wave = Math.sin(t / 37 + a.basePrice) * 0.8 + Math.sin(t / 11 + a.basePrice * 2) * 0.35;
  const drift = Math.sin(t / 211) * 0.6;
  const changePct = wave + drift;
  const price = a.basePrice * (1 + changePct / 100);
  return {
    symbol: a.symbol,
    price,
    changePct,
    high: a.basePrice * (1 + Math.abs(changePct) / 100 + 0.004),
    low: a.basePrice * (1 - Math.abs(changePct) / 100 - 0.004),
    volume: 125000 + (t % 50000),
    quoteVolume: (125000 + (t % 50000)) * price,
  };
}

export async function getSpotTickers(): Promise<Ticker[]> {
  if (spotCache && Date.now() - spotCache.at < TICKER_TTL) return spotCache.data;
  const symbols = CRYPTO_ASSETS.map((a) => a.symbol);
  try {
    const res = await fetch(`${BINANCE}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`binance ${res.status}`);
    const raw = (await res.json()) as Record<string, string>[];
    const live = raw.map(parse24h);
    const data = [...live, ...SIM_ASSETS.map(simTicker)];
    spotCache = { data, at: Date.now() };
    return data;
  } catch {
    if (spotCache) return spotCache.data;
    // offline fallback: simulate everything
    return [...CRYPTO_ASSETS.map((a) => simTicker({ ...a, basePrice: 100 })), ...SIM_ASSETS.map(simTicker)];
  }
}

export async function getFuturesTickers(): Promise<Ticker[]> {
  if (futCache && Date.now() - futCache.at < TICKER_TTL) return futCache.data;
  const wanted = new Set(CRYPTO_ASSETS.map((a) => a.symbol));
  try {
    const res = await fetch(`${BINANCE_F}/fapi/v1/ticker/24hr`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`binance futures ${res.status}`);
    const raw = (await res.json()) as Record<string, string>[];
    const data = raw.filter((t) => wanted.has(t.symbol)).map(parse24h);
    futCache = { data, at: Date.now() };
    return data;
  } catch {
    return futCache?.data ?? [];
  }
}

/** Current USD price for a trading symbol (crypto live, sim for stocks). */
export async function getPrice(symbol: string): Promise<number | null> {
  const sim = SIM_ASSETS.find((a) => a.symbol === symbol);
  if (sim) return simTicker(sim).price;
  const tickers = await getSpotTickers();
  return tickers.find((t) => t.symbol === symbol)?.price ?? null;
}

/** USD price for a base asset held in a wallet (USDT/USDC = 1). */
export async function getBaseAssetPrice(base: string): Promise<number | null> {
  if (base === 'USDT' || base === 'USDC' || base === 'USD') return 1;
  const meta = metaForBase(base);
  if (!meta) return null;
  return getPrice(meta.symbol);
}

export async function getKlines(symbol: string, interval = '1h', limit = 300) {
  const sim = SIM_ASSETS.find((a) => a.symbol === symbol);
  if (sim) return simKlines(sim, interval, limit);
  const res = await fetch(`${BINANCE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const raw = (await res.json()) as (string | number)[][];
  return raw.map((k) => ({
    time: Math.floor((k[0] as number) / 1000),
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
  }));
}

const INTERVAL_SEC: Record<string, number> = {
  '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400, '1w': 604800,
};

function simKlines(a: SimAsset, interval: string, limit: number) {
  const step = INTERVAL_SEC[interval] ?? 3600;
  const now = Math.floor(Date.now() / 1000);
  const start = now - step * limit;
  const out = [];
  let prev = a.basePrice;
  for (let i = 0; i < limit; i++) {
    const time = start + i * step;
    const t = Math.floor((time * 1000) / 15000);
    const wave = Math.sin(t / 37 + a.basePrice) * 0.8 + Math.sin(t / 11 + a.basePrice * 2) * 0.35;
    const close = a.basePrice * (1 + wave / 100);
    const open = prev;
    const high = Math.max(open, close) * 1.002;
    const low = Math.min(open, close) * 0.998;
    out.push({ time, open, high, low, close, volume: 1000 + (t % 500) });
    prev = close;
  }
  return out;
}

export async function getDepth(symbol: string, limit = 20) {
  const sim = SIM_ASSETS.find((a) => a.symbol === symbol);
  if (sim) {
    const price = simTicker(sim).price;
    const bids: [number, number][] = [];
    const asks: [number, number][] = [];
    for (let i = 1; i <= limit; i++) {
      bids.push([price * (1 - 0.0004 * i), Math.random() * 500 + 20]);
      asks.push([price * (1 + 0.0004 * i), Math.random() * 500 + 20]);
    }
    return { bids, asks };
  }
  const res = await fetch(`${BINANCE}/api/v3/depth?symbol=${symbol}&limit=${limit}`, { cache: 'no-store' });
  if (!res.ok) return { bids: [], asks: [] };
  const raw = (await res.json()) as { bids: [string, string][]; asks: [string, string][] };
  return {
    bids: raw.bids.map(([p, q]) => [parseFloat(p), parseFloat(q)] as [number, number]),
    asks: raw.asks.map(([p, q]) => [parseFloat(p), parseFloat(q)] as [number, number]),
  };
}

export async function getRecentTrades(symbol: string, limit = 30) {
  const sim = SIM_ASSETS.find((a) => a.symbol === symbol);
  if (sim) {
    const price = simTicker(sim).price;
    return Array.from({ length: limit }, (_, i) => ({
      price: price * (1 + (Math.random() - 0.5) * 0.001),
      qty: Math.random() * 50,
      time: Date.now() - i * 3000,
      isBuyerMaker: Math.random() > 0.5,
    }));
  }
  const res = await fetch(`${BINANCE}/api/v3/trades?symbol=${symbol}&limit=${limit}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const raw = (await res.json()) as { price: string; qty: string; time: number; isBuyerMaker: boolean }[];
  return raw.map((t) => ({ price: parseFloat(t.price), qty: parseFloat(t.qty), time: t.time, isBuyerMaker: t.isBuyerMaker }));
}
