'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { post, useUser } from '@/lib/hooks';
import { fmtGHS, fmtNum } from '@/lib/format';
import CoinIcon from '@/components/CoinIcon';

const ASSETS = [
  { id: 'USDT', name: 'Tether', color: '#26A17B' },
  { id: 'BTC', name: 'Bitcoin', color: '#F7931A' },
  { id: 'ETH', name: 'Ethereum', color: '#627EEA' },
  { id: 'SOL', name: 'Solana', color: '#9945FF' },
  { id: 'BNB', name: 'BNB', color: '#F3BA2F' },
  { id: 'XRP', name: 'XRP', color: '#23292F' },
  { id: 'GHS', name: 'Ghanaian Cedi (fiat balance)', color: '#CE1126' },
];

const METHODS = [
  { id: 'MOMO', label: 'Mobile Money', sub: 'MTN MoMo · Telecel Cash · AT Money', badge: '/pay/mtn.svg' },
  { id: 'CARD', label: 'Bank Card', sub: 'Visa · Mastercard', badge: '/pay/card.svg' },
  { id: 'BANK', label: 'Bank Transfer', sub: 'GHIPSS instant transfer', badge: '/pay/bank.svg' },
];

type Quote = {
  amountUSD: number;
  amountAsset: number;
  rateGHSUSD: number;
  assetPriceUSD: number;
};

export default function DepositPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [asset, setAsset] = useState('USDT');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('MOMO');
  const [phone, setPhone] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const amt = parseFloat(amount) || 0;

  useEffect(() => {
    if (!(amt >= 10)) {
      setQuote(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/deposit/quote?asset=${asset}&amountGHS=${amt}`);
        const q = await res.json();
        if (res.ok) setQuote(q);
      } catch {
        /* ignore */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [asset, amt]);

  async function startPayment() {
    setBusy(true);
    setError('');
    try {
      const res = await post<{ id: string; checkoutUrl: string }>('/api/deposit', {
        asset,
        amountGHS: amt,
        method,
        payerPhone: phone,
      });
      // Live checkout is an external Payteller URL; sandbox is in-app.
      if (res.checkoutUrl.startsWith('http')) window.location.assign(res.checkoutUrl);
      else router.push(res.checkoutUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start payment');
      setBusy(false);
    }
  }

  if (!loading && !user) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-2xl font-bold">Deposit</h1>
        <p className="mt-2 text-muted">Log in to deposit funds.</p>
        <Link href="/login" className="mt-4 inline-block rounded-lg bg-white px-6 py-2.5 font-semibold text-black">Log in</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pt-8">
      <h1 className="text-2xl font-bold">Deposit with Ghanaian Cedis</h1>
      <p className="mt-1 text-sm text-muted">
        Pay GH₵ via Payteller and receive crypto instantly at the live conversion rate.
      </p>

      {/* Steps */}
      <div className="mt-6 flex items-center gap-2 text-xs">
        {['Select Crypto', 'Amount & Method', 'Confirm & Pay'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full font-bold ${
                step > i ? 'bg-up text-white' : step === i + 1 ? 'bg-white text-black' : 'bg-panel2 text-muted'
              }`}
            >
              {i + 1}
            </span>
            <span className={step === i + 1 ? 'text-white' : 'text-muted'}>{s}</span>
            {i < 2 && <span className="mx-1 h-px w-8 bg-line" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ASSETS.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                setAsset(a.id);
                setStep(2);
              }}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left hover:border-accent ${
                asset === a.id ? 'border-accent bg-panel2' : 'border-line bg-panel'
              }`}
            >
              <CoinIcon asset={a.id} size={36} />
              <span>
                <div className="font-semibold">{a.id}</div>
                <div className="text-xs text-muted">{a.name}</div>
              </span>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 rounded-xl border border-line bg-panel p-6">
          <label className="block">
            <span className="text-sm text-muted">Amount (GH₵)</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Min 10.00"
              className="num mt-1 w-full rounded-lg border border-line bg-bg px-4 py-3 text-lg outline-none focus:border-accent"
            />
          </label>
          <div className="mt-2 flex gap-2">
            {[100, 500, 1000, 5000].map((v) => (
              <button key={v} onClick={() => setAmount(String(v))} className="rounded border border-line px-3 py-1 text-xs text-muted hover:border-accent hover:text-white">
                {fmtGHS(v)}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-2">
            {METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left ${
                  method === m.id ? 'border-accent bg-panel2' : 'border-line hover:border-muted'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.badge} alt="" className="h-9 w-9 rounded-lg" />
                <span>
                  <div className="text-sm font-semibold">{m.label}</div>
                  <div className="text-xs text-muted">{m.sub}</div>
                </span>
                <span className={`ml-auto h-4 w-4 rounded-full border-2 ${method === m.id ? 'border-accent bg-accent' : 'border-line'}`} />
              </button>
            ))}
          </div>

          {method === 'MOMO' && (
            <label className="mt-4 block">
              <span className="text-sm text-muted">MoMo Number</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="024 123 4567"
                className="mt-1 w-full rounded-lg border border-line bg-bg px-4 py-3 outline-none focus:border-accent"
              />
            </label>
          )}

          {quote && (
            <div className="num mt-5 space-y-1.5 rounded-lg border border-line bg-bg p-4 text-sm">
              <div className="flex justify-between text-muted">
                <span>Conversion rate</span>
                <span>1 USD = {quote.rateGHSUSD.toFixed(4)} GH₵</span>
              </div>
              {asset !== 'GHS' && (
                <div className="flex justify-between text-muted">
                  <span>{asset} price</span>
                  <span>${fmtNum(quote.assetPriceUSD, 2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
                <span>You receive</span>
                <span className="text-up">
                  {asset === 'GHS' ? fmtGHS(amt) : `${fmtNum(quote.amountAsset)} ${asset}`}
                </span>
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button onClick={() => setStep(1)} className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium hover:border-muted">
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!(amt >= 10) || (method === 'MOMO' && phone.replace(/\D/g, '').length < 9)}
              className="flex-1 rounded-lg bg-white py-2.5 font-semibold text-black hover:bg-gray-200 disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-6 rounded-xl border border-line bg-panel p-6">
          <h2 className="font-semibold">Confirm your deposit</h2>
          <div className="num mt-4 space-y-2 rounded-lg border border-line bg-bg p-4 text-sm">
            <div className="flex justify-between"><span className="text-muted">You pay</span><span className="font-semibold">{fmtGHS(amt)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Method</span><span>{METHODS.find((m) => m.id === method)?.label}{method === 'MOMO' ? ` (${phone})` : ''}</span></div>
            {quote && (
              <>
                <div className="flex justify-between"><span className="text-muted">Rate</span><span>1 USD = {quote.rateGHSUSD.toFixed(4)} GH₵</span></div>
                <div className="flex justify-between border-t border-line pt-2 text-base">
                  <span className="text-muted">You receive</span>
                  <span className="font-bold text-up">{asset === 'GHS' ? fmtGHS(amt) : `${fmtNum(quote.amountAsset)} ${asset}`}</span>
                </div>
              </>
            )}
          </div>
          <p className="mt-3 text-xs text-muted">
            You will be redirected to the Payteller payment gateway to authorize this payment.
          </p>
          {error && <p className="mt-2 text-sm text-down">{error}</p>}
          <div className="mt-5 flex gap-3">
            <button onClick={() => setStep(2)} className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium hover:border-muted">
              Back
            </button>
            <button
              onClick={startPayment}
              disabled={busy}
              className="flex-1 rounded-lg bg-up py-2.5 font-semibold text-white hover:brightness-110 disabled:opacity-40"
            >
              {busy ? 'Connecting to Payteller…' : `Pay ${fmtGHS(amt)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
