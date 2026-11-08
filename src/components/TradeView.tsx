'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import TradeChart from '@/components/TradeChart';
import OrderBook from '@/components/OrderBook';
import OrderForm from '@/components/OrderForm';
import RecentTrades from '@/components/RecentTrades';
import OpenOrders from '@/components/OpenOrders';
import { usePoll } from '@/lib/hooks';
import { fmtCompact, fmtGHS, fmtPct, fmtPrice } from '@/lib/format';
import type { MarketRow } from '@/components/MarketTable';
import CoinIcon from '@/components/CoinIcon';

/** Live last-price via Binance WebSocket (crypto), with graceful fallback to polling. */
function useLivePrice(symbol: string, isSim: boolean) {
  const [price, setPrice] = useState<number | null>(null);
  const prevRef = useRef<number | null>(null);
  const [up, setUp] = useState(true);

  useEffect(() => {
    if (isSim) return;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@miniTicker`);
      ws.onmessage = (ev) => {
        const d = JSON.parse(ev.data);
        const p = parseFloat(d.c);
        if (p > 0) {
          if (prevRef.current !== null && p !== prevRef.current) setUp(p > prevRef.current);
          prevRef.current = p;
          setPrice(p);
        }
      };
    } catch {
      /* fall back to polling */
    }
    return () => ws?.close();
  }, [symbol, isSim]);

  return { livePrice: price, up, feed: (p: number) => {
    if (prevRef.current !== null && p !== prevRef.current) setUp(p > prevRef.current);
    if (prevRef.current === null) prevRef.current = p;
    setPrice((prev) => (prev === null || isSim ? p : prev));
  } };
}

export default function TradeView({ symbol }: { symbol: string }) {
  const { data } = usePoll<{ markets: MarketRow[] }>('/api/markets?type=spot', 5000);
  const { data: fx } = usePoll<{ rate: number }>('/api/fx', 60000);
  const market = useMemo(() => data?.markets.find((m) => m.symbol === symbol), [data, symbol]);
  const isSim = market ? market.category === 'stock' || market.category === 'etf' : false;
  const { livePrice, up, feed } = useLivePrice(symbol, isSim);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (market?.price) feed(market.price);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market?.price]);

  const price = livePrice ?? market?.price ?? null;
  const precision = market?.precision ?? 2;

  if (data && !market) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-2xl font-bold">Unknown market: {symbol}</h1>
        <Link href="/markets" className="mt-4 inline-block text-accent hover:underline">← Back to markets</Link>
      </div>
    );
  }

  return (
    <div className="pt-4">
      {/* Ticker header */}
      <div className="mb-3 flex flex-wrap items-center gap-6 rounded-xl border border-line bg-panel px-4 py-3">
        <div className="flex items-center gap-3">
          <CoinIcon asset={market?.base ?? ''} size={32} />
          <div>
            <div className="font-bold">
              {market?.base}
              <span className="text-muted">/{market?.quote}</span>
            </div>
            <div className="text-xs text-muted">{market?.name}</div>
          </div>
        </div>
        <div>
          <div className={`num text-2xl font-bold ${up ? 'text-up' : 'text-down'}`}>
            {price ? fmtPrice(price, precision) : '—'}
          </div>
          <div className="num text-xs text-muted">
            {price && fx ? `≈ ${fmtGHS(price * fx.rate)}` : ''}
          </div>
        </div>
        <div className="hidden gap-8 text-xs md:flex">
          <div>
            <div className="text-muted">24h Change</div>
            <div className={`num font-medium ${((market?.changePct ?? 0) >= 0) ? 'text-up' : 'text-down'}`}>
              {market ? fmtPct(market.changePct) : '—'}
            </div>
          </div>
          <div>
            <div className="text-muted">24h High</div>
            <div className="num">{market ? fmtPrice(market.high, precision) : '—'}</div>
          </div>
          <div>
            <div className="text-muted">24h Low</div>
            <div className="num">{market ? fmtPrice(market.low, precision) : '—'}</div>
          </div>
          <div>
            <div className="text-muted">24h Volume (USDT)</div>
            <div className="num">{market ? fmtCompact(market.quoteVolume) : '—'}</div>
          </div>
        </div>
        <Link href="/markets" className="ml-auto text-xs text-muted hover:text-white">
          All markets →
        </Link>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[260px_1fr_300px]" style={{ minHeight: 520 }}>
        <div className="order-2 overflow-hidden rounded-xl border border-line bg-panel lg:order-1">
          <BookAndTrades symbol={symbol} precision={precision} lastPrice={price} changeUp={up} />
        </div>
        <div className="order-1 h-[420px] overflow-hidden rounded-xl border border-line bg-panel lg:order-2 lg:h-auto">
          <TradeChart symbol={symbol} />
        </div>
        <div className="order-3 rounded-xl border border-line bg-panel">
          <OrderForm
            symbol={symbol}
            base={market?.base ?? ''}
            quote={market?.quote ?? 'USDT'}
            lastPrice={price}
            qtyPrecision={market?.precision != null ? Math.max(2, 8 - market.precision) : 4}
            onPlaced={() => setRefreshKey((k) => k + 1)}
          />
        </div>
      </div>

      <div className="mt-3">
        <OpenOrders refreshKey={refreshKey} />
      </div>
    </div>
  );
}

function BookAndTrades(props: { symbol: string; precision: number; lastPrice: number | null; changeUp: boolean }) {
  const [tab, setTab] = useState<'book' | 'trades'>('book');
  return (
    <div className="flex h-full min-h-[480px] flex-col">
      <div className="flex gap-1 border-b border-line px-2 py-2">
        <button
          onClick={() => setTab('book')}
          className={`rounded px-3 py-1 text-xs font-medium ${tab === 'book' ? 'bg-panel2 text-white' : 'text-muted'}`}
        >
          Order Book
        </button>
        <button
          onClick={() => setTab('trades')}
          className={`rounded px-3 py-1 text-xs font-medium ${tab === 'trades' ? 'bg-panel2 text-white' : 'text-muted'}`}
        >
          Market Trades
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {tab === 'book' ? <OrderBook {...props} /> : <RecentTrades symbol={props.symbol} precision={props.precision} />}
      </div>
    </div>
  );
}
