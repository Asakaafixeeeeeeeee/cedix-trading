'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { post, usePoll, useUser } from '@/lib/hooks';
import { useContent } from '@/lib/useContent';
import { fmtGHS, fmtNum } from '@/lib/format';
import { IconCheckCircle } from '@/components/icons';
import type { Portfolio } from '@/lib/wallet';

type Quote = { netGHS: number; feeGHS: number; feePct: number; rateGHSUSD: number };

export default function MobileWithdraw() {
  const { user, loading } = useUser();
  const { t } = useContent();
  const { data: portfolio, refresh } = usePoll<Portfolio>(user ? '/api/portfolio' : null, 10000);
  const [asset, setAsset] = useState('USDT');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'MOMO' | 'BANK'>('MOMO');
  const [destination, setDestination] = useState('');
  const [destName, setDestName] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [limits, setLimits] = useState<{ minWithdrawalUSD: number; minWithdrawalGHS: number; withdrawMinPurchases?: number; completedPurchases?: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/limits').then((r) => r.json()).then(setLimits).catch(() => {});
  }, []);
  const [phase, setPhase] = useState<'form' | 'processing' | 'submitted'>('form');
  const [submittedGHS, setSubmittedGHS] = useState(0);

  const amt = parseFloat(amount) || 0;
  const assets = portfolio?.assets ?? [];
  const selected = assets.find((a) => a.asset === asset);
  const amountUSD = selected ? amt * selected.priceUSD : 0;

  useEffect(() => {
    if (!(amt > 0)) return setQuote(null);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/withdraw/quote?asset=${asset}&amount=${amt}`);
      if (res.ok) setQuote(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [asset, amt]);

  async function submit() {
    setPhase('processing');
    setError('');
    const started = Date.now();
    try {
      const res = await post<{ netGHS: number }>('/api/withdraw', { asset, amountAsset: amt, method, destination, destName });
      // Keep the processing screen visible briefly so it never just flashes
      const wait = Math.max(0, 1600 - (Date.now() - started));
      setTimeout(() => {
        setSubmittedGHS(res.netGHS);
        setPhase('submitted');
        setAmount('');
        refresh();
      }, wait);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit withdrawal');
      setPhase('form');
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

  // ── Processing screen ──
  if (phase === 'processing') {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-gray-200 border-t-transparent" />
        <h2 className="mt-6 text-[15px] font-semibold">Processing Your Withdrawal Request</h2>
        <p className="mt-1 text-xs text-muted">Please wait…</p>
      </div>
    );
  }

  // ── Submitted screen ──
  if (phase === 'submitted') {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 pb-20 text-center">
        <IconCheckCircle size={56} className="text-emerald-500" />
        <h2 className="mt-4 text-[17px] font-bold">Withdrawal Request Submitted</h2>
        <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted">
          Your withdrawal request for {fmtGHS(submittedGHS)} has been received. Our team will review your account and
          notify you when a decision has been made.
        </p>
        <p className="mt-3 rounded-full bg-panel px-4 py-1.5 text-xs font-medium text-gold">Status: Pending Review</p>
        <div className="mt-6 w-full max-w-xs space-y-2">
          <Link href="/m/withdrawals" className="block rounded-xl bg-white py-3 text-[13px] font-semibold text-black">
            View Withdrawal Status
          </Link>
          <button onClick={() => setPhase('form')} className="block w-full rounded-xl bg-panel py-3 text-[13px] font-semibold">
            New withdrawal
          </button>
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <div className="px-4 pt-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[17px] font-bold">{t('withdraw.title')}</h1>
        <Link href="/m/withdrawals" className="text-xs text-accent">History</Link>
      </div>
      <p className="mt-1 text-xs text-muted">
        {t('withdraw.instructions')}
        {limits && <> Minimum withdrawal: <b className="text-white/80">${fmtNum(limits.minWithdrawalUSD)}</b>.</>}
      </p>
      {limits && (limits.withdrawMinPurchases ?? 0) > 0 && (
        <p className="mt-2 rounded-lg bg-panel px-3 py-2 text-[11px] text-muted">
          Withdrawal eligibility: {limits.withdrawMinPurchases} completed purchase{(limits.withdrawMinPurchases ?? 0) > 1 ? 's' : ''} required
          {' '}(<b className={`${(limits.completedPurchases ?? 0) >= (limits.withdrawMinPurchases ?? 0) ? 'text-up' : 'text-gold'}`}>{limits.completedPurchases ?? 0}/{limits.withdrawMinPurchases}</b> done).
          Only genuinely completed buy orders count.
        </p>
      )}

      <div className="-mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
        {(assets.length ? assets.map((a) => a.asset) : ['USDT']).map((a) => (
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
        <div className="flex justify-between text-xs text-muted">
          <span>Available balance</span>
          {selected && (
            <button onClick={() => setAmount(String(selected.available))} className="text-accent">
              Max {fmtNum(selected.available)} {asset}
            </button>
          )}
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="num mt-1 w-full bg-transparent text-[24px] font-bold outline-none placeholder:text-line"
        />
        {amountUSD > 0 && <p className="text-xs text-muted">≈ ${amountUSD.toFixed(2)}</p>}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={() => setMethod('MOMO')} className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-bold ${method === 'MOMO' ? 'border-accent bg-panel2' : 'border-line bg-panel text-muted'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pay/mtn.svg" alt="" className="h-5 w-5 rounded" />
          MobileMoney
        </button>
        <button onClick={() => setMethod('BANK')} className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-bold ${method === 'BANK' ? 'border-accent bg-panel2' : 'border-line bg-panel text-muted'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pay/bank.svg" alt="" className="h-5 w-5 rounded" />
          Bank
        </button>
      </div>

      <input
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        placeholder={method === 'MOMO' ? 'MoMo number' : 'Bank account number'}
        className="mt-3 w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
      />
      <input
        value={destName}
        onChange={(e) => setDestName(e.target.value)}
        placeholder="Recipient name (as registered)"
        className="mt-2 w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
      />

      {quote && amt > 0 && (
        <div className="num mt-4 space-y-1 rounded-xl border border-line bg-panel p-4 text-[13px]">
          <div className="flex justify-between text-muted">
            <span>Estimated GHS amount</span>
            <span>{fmtGHS(quote.netGHS + quote.feeGHS)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Exchange rate</span>
            <span>1 USD = {quote.rateGHSUSD.toFixed(4)} GHS</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Fee ({quote.feePct}%)</span>
            <span>-{fmtGHS(quote.feeGHS)}</span>
          </div>
          <div className="flex justify-between border-t border-line pt-1.5 font-bold">
            <span>Final amount to receive</span>
            <span className="text-up">{fmtGHS(quote.netGHS)}</span>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-down">{error}</p>}
      {limits && amountUSD > 0 && amountUSD < limits.minWithdrawalUSD && (
        <p className="mt-2 text-xs text-gold">Minimum withdrawal is ${fmtNum(limits.minWithdrawalUSD)} (≈ {fmtGHS(limits.minWithdrawalGHS)}).</p>
      )}
      <button
        onClick={submit}
        disabled={!(amt > 0) || destination.replace(/\D/g, '').length < 8 || (limits ? amountUSD < limits.minWithdrawalUSD : false)}
        className="mt-4 w-full rounded-full bg-white py-3 text-[14px] font-bold text-black disabled:opacity-40"
      >
        Confirm withdrawal request
      </button>
      <p className="mb-4 mt-2 text-center text-[11px] text-muted">
        Requests are reviewed by our team. You will be notified when a decision is made.
      </p>
    </div>
  );
}
