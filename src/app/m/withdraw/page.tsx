'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { post, usePoll, useUser } from '@/lib/hooks';
import { fmtGHS, fmtNum } from '@/lib/format';
import type { Portfolio } from '@/lib/wallet';

type Quote = { netGHS: number; feeGHS: number; feePct: number; rateGHSUSD: number };

export default function MobileWithdraw() {
  const { user, loading } = useUser();
  const { data: portfolio, refresh } = usePoll<Portfolio>(user ? '/api/portfolio' : null, 10000);
  const [asset, setAsset] = useState('USDT');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'MOMO' | 'BANK'>('MOMO');
  const [destination, setDestination] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const amt = parseFloat(amount) || 0;
  const assets = portfolio?.assets ?? [];
  const selected = assets.find((a) => a.asset === asset);

  useEffect(() => {
    if (!(amt > 0)) return setQuote(null);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/withdraw/quote?asset=${asset}&amount=${amt}`);
      if (res.ok) setQuote(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [asset, amt]);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await post<{ netGHS: number }>('/api/withdraw', { asset, amountAsset: amt, method, destination });
      setMsg({ ok: true, text: `${fmtGHS(res.netGHS)} sent to your ${method === 'MOMO' ? 'MoMo' : 'bank'} 🎉` });
      setAmount('');
      refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Failed' });
    } finally {
      setBusy(false);
    }
  }

  if (!loading && !user) {
    return (
      <div className="px-4 pt-24 text-center">
        <p className="text-sm text-muted">Log in to withdraw.</p>
        <Link href="/m/login" className="mt-3 inline-block rounded-xl bg-white px-8 py-3 font-semibold text-black">Log in</Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4">
      <h1 className="text-xl font-bold">🏦 Withdraw to GH₵</h1>
      <p className="mt-1 text-xs text-muted">Cash out any crypto straight to MoMo or bank — no selling step.</p>

      <div className="-mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
        {(assets.length ? assets.map((a) => a.asset) : ['USDT']).map((a) => (
          <button
            key={a}
            onClick={() => setAsset(a)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${asset === a ? 'bg-white text-black' : 'bg-panel text-muted'}`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-panel p-4">
        <div className="flex justify-between text-xs text-muted">
          <span>Amount ({asset})</span>
          {selected && (
            <button onClick={() => setAmount(String(selected.available))} className="text-accent">
              Max {fmtNum(selected.available)}
            </button>
          )}
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="num mt-1 w-full bg-transparent text-3xl font-bold outline-none placeholder:text-line"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={() => setMethod('MOMO')} className={`rounded-xl border py-3 text-xs font-bold ${method === 'MOMO' ? 'border-accent bg-panel2' : 'border-line bg-panel text-muted'}`}>
          📱 Mobile Money
        </button>
        <button onClick={() => setMethod('BANK')} className={`rounded-xl border py-3 text-xs font-bold ${method === 'BANK' ? 'border-accent bg-panel2' : 'border-line bg-panel text-muted'}`}>
          🏦 Bank
        </button>
      </div>

      <input
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        placeholder={method === 'MOMO' ? 'MoMo number' : 'Bank account number'}
        className="mt-3 w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
      />

      {quote && amt > 0 && (
        <div className="num mt-4 rounded-xl border border-line bg-panel p-4 text-sm">
          <div className="flex justify-between text-muted">
            <span>Fee ({quote.feePct}%)</span>
            <span>-{fmtGHS(quote.feeGHS)}</span>
          </div>
          <div className="mt-1 flex justify-between font-bold">
            <span>You receive</span>
            <span className="text-up">{fmtGHS(quote.netGHS)}</span>
          </div>
        </div>
      )}

      {msg && <p className={`mt-3 text-sm ${msg.ok ? 'text-up' : 'text-down'}`}>{msg.text}</p>}
      <button
        onClick={submit}
        disabled={busy || !(amt > 0) || destination.replace(/\D/g, '').length < 8}
        className="mt-4 w-full rounded-xl bg-white py-3.5 font-bold text-black disabled:opacity-40"
      >
        {busy ? 'Processing…' : 'Withdraw via Payteller'}
      </button>
    </div>
  );
}
