'use client';
import { useEffect, useState } from 'react';
import { post, usePoll, useUser } from '@/lib/hooks';
import { fmtNum } from '@/lib/format';
import type { Portfolio } from '@/lib/wallet';
import Link from 'next/link';

export default function OrderForm({ symbol, base, quote, lastPrice, qtyPrecision, onPlaced }: {
  symbol: string;
  base: string;
  quote: string;
  lastPrice: number | null;
  qtyPrecision: number;
  onPlaced: () => void;
}) {
  const { user } = useUser();
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [type, setType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: portfolio, refresh } = usePoll<Portfolio>(user ? '/api/portfolio' : null, 10000);

  useEffect(() => {
    if (type === 'LIMIT' && !price && lastPrice) setPrice(lastPrice.toFixed(2));
  }, [type, lastPrice, price]);

  const baseBal = portfolio?.assets.find((a) => a.asset === base)?.available ?? 0;
  const quoteBal = portfolio?.assets.find((a) => a.asset === quote)?.available ?? 0;
  const effPrice = type === 'LIMIT' ? parseFloat(price) || 0 : lastPrice || 0;
  const total = (parseFloat(qty) || 0) * effPrice;

  function setPercent(p: number) {
    if (side === 'SELL') {
      setQty(((baseBal * p) / 100).toFixed(qtyPrecision));
    } else if (effPrice > 0) {
      setQty((((quoteBal * p) / 100) * 0.999 / effPrice).toFixed(qtyPrecision));
    }
  }

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      await post('/api/orders', {
        symbol,
        side,
        type,
        price: type === 'LIMIT' ? parseFloat(price) : undefined,
        quantity: parseFloat(qty),
      });
      setMsg({ ok: true, text: type === 'MARKET' ? 'Order filled!' : 'Order placed.' });
      setQty('');
      refresh();
      onPlaced();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Order failed' });
    } finally {
      setBusy(false);
    }
  }

  const input = 'w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent num';

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-line text-sm font-semibold">
        <button onClick={() => setSide('BUY')} className={`py-2.5 ${side === 'BUY' ? 'bg-up text-white' : 'text-muted'}`}>
          Buy
        </button>
        <button onClick={() => setSide('SELL')} className={`py-2.5 ${side === 'SELL' ? 'bg-down text-white' : 'text-muted'}`}>
          Sell
        </button>
      </div>
      <div className="flex gap-2 text-xs">
        {(['MARKET', 'LIMIT'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded px-3 py-1.5 font-medium ${type === t ? 'bg-panel2 text-white' : 'text-muted hover:text-white'}`}
          >
            {t === 'MARKET' ? 'Market' : 'Limit'}
          </button>
        ))}
      </div>

      {type === 'LIMIT' && (
        <label className="block">
          <span className="text-xs text-muted">Price ({quote})</span>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={input} />
        </label>
      )}
      <label className="block">
        <span className="text-xs text-muted">Amount ({base})</span>
        <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0.00" className={input} />
      </label>
      <div className="grid grid-cols-4 gap-1.5">
        {[25, 50, 75, 100].map((p) => (
          <button key={p} onClick={() => setPercent(p)} className="rounded border border-line py-1 text-[11px] text-muted hover:border-accent hover:text-white">
            {p}%
          </button>
        ))}
      </div>
      <div className="space-y-1 text-xs text-muted">
        <div className="flex justify-between">
          <span>Total</span>
          <span className="num text-white">{total > 0 ? `${fmtNum(total, 2)} ${quote}` : '—'}</span>
        </div>
        <div className="flex justify-between">
          <span>Available</span>
          <span className="num">
            {side === 'BUY' ? `${fmtNum(quoteBal, 2)} ${quote}` : `${fmtNum(baseBal, qtyPrecision)} ${base}`}
          </span>
        </div>
      </div>
      {msg && <p className={`text-xs ${msg.ok ? 'text-up' : 'text-down'}`}>{msg.text}</p>}
      {user ? (
        <button
          onClick={submit}
          disabled={busy || !(parseFloat(qty) > 0)}
          className={`mt-auto rounded-lg py-3 font-semibold text-white disabled:opacity-40 ${
            side === 'BUY' ? 'bg-up hover:brightness-110' : 'bg-down hover:brightness-110'
          }`}
        >
          {busy ? 'Placing…' : `${side === 'BUY' ? 'Buy' : 'Sell'} ${base}`}
        </button>
      ) : (
        <Link href="/login" className="mt-auto rounded-lg bg-white py-3 text-center font-semibold text-black">
          Log in to trade
        </Link>
      )}
    </div>
  );
}
