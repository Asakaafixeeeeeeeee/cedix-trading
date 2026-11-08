'use client';
import Link from 'next/link';
import { useState } from 'react';
import { post, usePoll, useUser } from '@/lib/hooks';
import { fmtNum, timeAgo } from '@/lib/format';

type Product = {
  id: string;
  type: 'STAKING' | 'SAVINGS';
  asset: string;
  name: string;
  apy: string;
  termDays: number | null;
  minAmount: string;
};

type Position = {
  id: string;
  amount: string;
  accrued: string;
  status: string;
  startedAt: string;
  endsAt: string | null;
  product: Product;
};

export default function EarnSection() {
  const { user } = useUser();
  const { data, refresh } = usePoll<{ products: Product[] }>('/api/earn/products', 0);
  const { data: posData, refresh: refreshPos } = usePoll<{ positions: Position[] }>(user ? '/api/earn/positions' : null, 15000);
  const [subscribing, setSubscribing] = useState<Product | null>(null);

  const staking = (data?.products ?? []).filter((p) => p.type === 'STAKING');
  const savings = (data?.products ?? []).filter((p) => p.type === 'SAVINGS');
  const positions = (posData?.positions ?? []).filter((p) => p.status === 'ACTIVE');

  function Grid({ items }: { items: Product[] }) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((p) => (
          <div key={p.id} className="rounded-xl border border-line bg-panel p-4">
            <div className="flex items-center justify-between">
              <span className="font-bold">{p.asset}</span>
              <span className="rounded bg-panel2 px-2 py-0.5 text-[10px] uppercase text-muted">
                {p.termDays ? `${p.termDays}-day` : 'Flexible'}
              </span>
            </div>
            <div className="num mt-3 text-2xl font-bold text-up">{Number(p.apy).toFixed(2)}%</div>
            <div className="text-xs text-muted">Est. APY</div>
            <div className="mt-2 text-xs text-muted">{p.name}</div>
            <div className="mt-1 text-xs text-muted">Min: {fmtNum(Number(p.minAmount))} {p.asset}</div>
            <button
              onClick={() => (user ? setSubscribing(p) : (window.location.href = '/login'))}
              className="mt-4 w-full rounded-lg bg-white py-2 text-sm font-semibold text-black hover:bg-gray-200"
            >
              Subscribe
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {user && positions.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">My Positions</h2>
          <div className="rounded-xl border border-line bg-panel">
            {positions.map((pos) => (
              <PositionRow key={pos.id} pos={pos} onChange={() => { refreshPos(); refresh(); }} />
            ))}
          </div>
        </section>
      )}
      <section>
        <h2 className="mb-3 text-lg font-bold">Staking</h2>
        <Grid items={staking} />
      </section>
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Savings</h2>
        <Grid items={savings} />
      </section>
      {subscribing && (
        <SubscribeModal
          product={subscribing}
          onClose={() => setSubscribing(null)}
          onDone={() => {
            setSubscribing(null);
            refreshPos();
          }}
        />
      )}
      {!user && (
        <p className="mt-8 text-center text-sm text-muted">
          <Link href="/login" className="text-accent hover:underline">Log in</Link> to start earning.
        </p>
      )}
    </div>
  );
}

function PositionRow({ pos, onChange }: { pos: Position; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const locked = pos.endsAt && new Date(pos.endsAt).getTime() > Date.now();

  async function redeem() {
    setBusy(true);
    try {
      await post('/api/earn/redeem', { positionId: pos.id });
      onChange();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Redeem failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-line/60 px-4 py-3 text-sm last:border-0">
      <div>
        <div className="font-semibold">{pos.product.name}</div>
        <div className="text-xs text-muted">Started {timeAgo(pos.startedAt)}{pos.endsAt ? ` · unlocks ${new Date(pos.endsAt).toLocaleDateString()}` : ''}</div>
      </div>
      <div className="num">
        {fmtNum(Number(pos.amount))} {pos.product.asset}
        <span className="ml-2 text-xs text-up">+{Number(pos.accrued).toFixed(8)} earned</span>
      </div>
      <div className="num text-xs text-up">{Number(pos.product.apy).toFixed(2)}% APY</div>
      <button
        onClick={redeem}
        disabled={busy || !!locked}
        className="ml-auto rounded-lg border border-line px-4 py-1.5 text-xs font-medium hover:border-accent disabled:opacity-40"
        title={locked ? 'Locked until term ends' : ''}
      >
        {locked ? 'Locked' : busy ? 'Redeeming…' : 'Redeem'}
      </button>
    </div>
  );
}

function SubscribeModal({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const amt = parseFloat(amount) || 0;
  const yearly = amt * (Number(product.apy) / 100);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await post('/api/earn/subscribe', { productId: product.id, amount: amt });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">{product.name}</h2>
          <button onClick={onClose} className="text-muted hover:text-white">✕</button>
        </div>
        <div className="num rounded-lg border border-line bg-bg p-3 text-sm">
          <div className="flex justify-between"><span className="text-muted">APY</span><span className="font-bold text-up">{Number(product.apy).toFixed(2)}%</span></div>
          <div className="flex justify-between"><span className="text-muted">Term</span><span>{product.termDays ? `${product.termDays} days (locked)` : 'Flexible — redeem anytime'}</span></div>
          <div className="flex justify-between"><span className="text-muted">Minimum</span><span>{fmtNum(Number(product.minAmount))} {product.asset}</span></div>
        </div>
        <label className="mt-4 block">
          <span className="text-sm text-muted">Amount ({product.asset})</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="num mt-1 w-full rounded-lg border border-line bg-bg px-4 py-3 outline-none focus:border-accent"
            placeholder="0.00"
          />
        </label>
        {amt > 0 && (
          <p className="num mt-2 text-xs text-muted">
            Est. yearly earnings: <span className="text-up">+{yearly.toFixed(8)} {product.asset}</span>
          </p>
        )}
        {error && <p className="mt-2 text-sm text-down">{error}</p>}
        <button onClick={submit} disabled={busy || !(amt > 0)} className="mt-4 w-full rounded-lg bg-white py-3 font-semibold text-black disabled:opacity-40">
          {busy ? 'Subscribing…' : 'Confirm Subscription'}
        </button>
      </div>
    </div>
  );
}
