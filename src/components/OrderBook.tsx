'use client';
import { usePoll } from '@/lib/hooks';
import { fmtPrice } from '@/lib/format';

type Depth = { bids: [number, number][]; asks: [number, number][] };

export default function OrderBook({ symbol, precision, lastPrice, changeUp }: {
  symbol: string;
  precision: number;
  lastPrice: number | null;
  changeUp: boolean;
}) {
  const { data } = usePoll<Depth>(`/api/markets/depth?symbol=${symbol}&limit=12`, 2500);
  const asks = (data?.asks ?? []).slice(0, 12).reverse();
  const bids = (data?.bids ?? []).slice(0, 12);
  const maxQty = Math.max(1e-9, ...asks.map(([, q]) => q), ...bids.map(([, q]) => q));

  function Row({ price, qty, side }: { price: number; qty: number; side: 'ask' | 'bid' }) {
    return (
      <div className="relative grid grid-cols-2 px-3 py-[3px] text-xs">
        <div
          className={`absolute inset-y-0 right-0 ${side === 'ask' ? 'bg-down/10' : 'bg-up/10'}`}
          style={{ width: `${Math.min(100, (qty / maxQty) * 100)}%` }}
        />
        <span className={`num relative ${side === 'ask' ? 'text-down' : 'text-up'}`}>{fmtPrice(price, precision)}</span>
        <span className="num relative text-right text-muted">{qty.toFixed(4)}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-2 px-3 py-2 text-[11px] text-muted">
        <span>Price (USDT)</span>
        <span className="text-right">Amount</span>
      </div>
      <div className="flex-1 overflow-hidden">
        {asks.map(([p, q], i) => (
          <Row key={`a${i}`} price={p} qty={q} side="ask" />
        ))}
      </div>
      <div className={`num border-y border-line px-3 py-2 text-lg font-bold ${changeUp ? 'text-up' : 'text-down'}`}>
        {lastPrice ? fmtPrice(lastPrice, precision) : '—'}
        <span className="ml-1 text-xs">{changeUp ? '▲' : '▼'}</span>
      </div>
      <div className="flex-1 overflow-hidden">
        {bids.map(([p, q], i) => (
          <Row key={`b${i}`} price={p} qty={q} side="bid" />
        ))}
      </div>
    </div>
  );
}
