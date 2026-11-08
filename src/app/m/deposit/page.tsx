'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { post, useUser } from '@/lib/hooks';
import { fmtGHS, fmtNum } from '@/lib/format';

const ASSETS = ['USDT', 'BTC', 'ETH', 'SOL', 'BNB', 'GHS'];
const METHODS = [
  ['MOMO', 'Mobile Money', '/pay/mtn.svg'],
  ['CARD', 'Card', '/pay/card.svg'],
  ['BANK', 'Bank', '/pay/bank.svg'],
] as const;

type Quote = { amountAsset: number; rateGHSUSD: number };

export default function MobileDeposit() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [asset, setAsset] = useState('USDT');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('MOMO');
  const [phone, setPhone] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const amt = parseFloat(amount) || 0;

  useEffect(() => {
    if (!(amt >= 10)) return setQuote(null);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/deposit/quote?asset=${asset}&amountGHS=${amt}`);
      if (res.ok) setQuote(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [asset, amt]);

  async function pay() {
    setBusy(true);
    setError('');
    try {
      const res = await post<{ checkoutUrl: string }>('/api/deposit', { asset, amountGHS: amt, method, payerPhone: phone });
      router.push(res.checkoutUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setBusy(false);
    }
  }

  if (!loading && !user) {
    return (
      <div className="px-4 pt-24 text-center">
        <p className="text-sm text-muted">Log in to deposit.</p>
        <Link href="/m/login" className="mt-3 inline-block rounded-xl bg-white px-8 py-3 font-semibold text-black">Log in</Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4">
      <h1 className="text-[17px] font-bold">Deposit GH₵</h1>
      <p className="mt-1 text-xs text-muted">Pay with MoMo, card or bank via Payteller — receive crypto instantly.</p>

      <div className="-mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
        {ASSETS.map((a) => (
          <button
            key={a}
            onClick={() => setAsset(a)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold ${asset === a ? 'bg-white text-black' : 'bg-panel text-muted'}`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-panel p-4">
        <span className="text-xs text-muted">Amount (GH₵)</span>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="num mt-1 w-full bg-transparent text-[26px] font-bold outline-none placeholder:text-line"
        />
        <div className="mt-2 flex gap-2">
          {[50, 200, 1000].map((v) => (
            <button key={v} onClick={() => setAmount(String(v))} className="rounded-full bg-panel2 px-3 py-1 text-[11px] text-muted">
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {METHODS.map(([id, label, badge]) => (
          <button
            key={id}
            onClick={() => setMethod(id)}
            className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-bold ${method === id ? 'border-accent bg-panel2' : 'border-line bg-panel text-muted'}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={badge} alt="" className="h-7 w-7 rounded-lg" />
            {label}
          </button>
        ))}
      </div>

      {method === 'MOMO' && (
        <>
          <div className="mt-3 flex items-center gap-2 px-1">
            <span className="text-[11px] font-medium text-muted">Supported networks:</span>
            {['/pay/mtn.svg', '/pay/telecel.svg', '/pay/at.svg'].map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={s} src={s} alt="" className="h-5 w-5 rounded" />
            ))}
          </div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="MoMo number — 024 123 4567"
            className="mt-2 w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
          />
        </>
      )}

      {quote && amt >= 10 && (
        <div className="num mt-4 rounded-xl border border-line bg-panel p-4 text-sm">
          <div className="flex justify-between text-muted">
            <span>Rate</span>
            <span>1 USD = {quote.rateGHSUSD.toFixed(4)} GH₵</span>
          </div>
          <div className="mt-1 flex justify-between font-bold">
            <span>You receive</span>
            <span className="text-up">{asset === 'GHS' ? fmtGHS(amt) : `${fmtNum(quote.amountAsset)} ${asset}`}</span>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-down">{error}</p>}
      <button
        onClick={pay}
        disabled={busy || !(amt >= 10) || (method === 'MOMO' && phone.replace(/\D/g, '').length < 9)}
        className="mt-4 w-full rounded-full bg-up py-3 text-[14px] font-bold text-white disabled:opacity-40"
      >
        {busy ? 'Connecting…' : `Pay ${amt >= 10 ? fmtGHS(amt) : ''} with Payteller`}
      </button>
    </div>
  );
}
