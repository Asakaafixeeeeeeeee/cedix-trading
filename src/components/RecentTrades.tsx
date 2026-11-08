'use client';
import { usePoll } from '@/lib/hooks';
import { fmtPrice } from '@/lib/format';

type T = { price: number; qty: number; time: number; isBuyerMaker: boolean };

export default function RecentTrades({ symbol, precision }: { symbol: string; precision: number }) {
  const { data } = usePoll<{ trades: T[] }>(`/api/markets/trades?symbol=${symbol}`, 4000);
  const trades = (data?.trades ?? []).slice(-24).reverse();
  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-3 px-3 py-2 text-[11px] text-muted">
        <span>Price</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Time</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {trades.map((t, i) => (
          <div key={i} className="grid grid-cols-3 px-3 py-[3px] text-xs">
            <span className={`num ${t.isBuyerMaker ? 'text-down' : 'text-up'}`}>{fmtPrice(t.price, precision)}</span>
            <span className="num text-right text-muted">{t.qty.toFixed(4)}</span>
            <span className="num text-right text-muted">{new Date(t.time).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
