'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import TradeChart from '@/components/TradeChart';
import OrderForm from '@/components/OrderForm';
import OrderBook from '@/components/OrderBook';
import { usePoll } from '@/lib/hooks';
import { fmtGHS, fmtPct, fmtPrice } from '@/lib/format';
import type { MarketRow } from '@/components/MarketTable';
import CoinIcon from '@/components/CoinIcon';

export default function MobileTradeView({ symbol }: { symbol: string }) {
  const { data } = usePoll<{ markets: MarketRow[] }>('/api/markets?type=spot', 5000);
  const { data: fx } = usePoll<{ rate: number }>('/api/fx', 60000);
  const market = useMemo(() => data?.markets.find((m) => m.symbol === symbol), [data, symbol]);
  const [view, setView] = useState<'chart' | 'book' | 'trade'>('chart');
  const [, setRefreshKey] = useState(0);

  const price = market?.price ?? null;
  const precision = market?.precision ?? 2;
  const up = (market?.changePct ?? 0) >= 0;

  return (
    <div className="pt-3">
      {/* Pair header */}
      <div className="flex items-center justify-between px-4">
        <Link href="/m/markets" className="flex items-center gap-2">
          <span className="text-muted">‹</span>
          <CoinIcon asset={market?.base ?? ''} size={28} />
          <span className="font-bold">
            {market?.base}
            <span className="text-muted">/{market?.quote}</span>
          </span>
        </Link>
        <div className="text-right">
          <div className={`num font-bold ${up ? 'text-up' : 'text-down'}`}>
            {price ? fmtPrice(price, precision) : '—'}
          </div>
          <div className="num text-[10px] text-muted">
            {price && fx ? `≈ ${fmtGHS(price * fx.rate)}` : ''}{' '}
            <span className={up ? 'text-up' : 'text-down'}>{market ? fmtPct(market.changePct) : ''}</span>
          </div>
        </div>
      </div>

      {/* View switcher */}
      <div className="mt-3 grid grid-cols-3 gap-1 px-4">
        {(
          [
            ['chart', '📈 Chart'],
            ['book', '📖 Book'],
            ['trade', '⚡ Trade'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`rounded-lg py-2 text-xs font-semibold ${view === id ? 'bg-white text-black' : 'bg-panel text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {view === 'chart' && (
          <div className="h-[380px] border-y border-line bg-panel">
            <TradeChart symbol={symbol} />
          </div>
        )}
        {view === 'book' && (
          <div className="h-[420px] border-y border-line bg-panel">
            <OrderBook symbol={symbol} precision={precision} lastPrice={price} changeUp={up} />
          </div>
        )}
        {view === 'trade' && (
          <div className="border-y border-line bg-panel">
            <OrderForm
              symbol={symbol}
              base={market?.base ?? ''}
              quote={market?.quote ?? 'USDT'}
              lastPrice={price}
              qtyPrecision={market?.precision != null ? Math.max(2, 8 - market.precision) : 4}
              onPlaced={() => setRefreshKey((k) => k + 1)}
            />
          </div>
        )}
      </div>

      {view !== 'trade' && (
        <div className="fixed inset-x-0 bottom-14 z-40 mx-auto max-w-lg px-4 pb-2">
          <button
            onClick={() => setView('trade')}
            className="w-full rounded-xl bg-white py-3 text-sm font-bold text-black shadow-lg"
          >
            Trade {market?.base}
          </button>
        </div>
      )}
    </div>
  );
}
