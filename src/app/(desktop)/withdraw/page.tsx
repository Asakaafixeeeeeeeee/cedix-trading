'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { post, usePoll, useUser } from '@/lib/hooks';
import { fmtGHS, fmtNum, timeAgo } from '@/lib/format';
import type { Portfolio } from '@/lib/wallet';

type Quote = {
  grossGHS: number;
  feeGHS: number;
  netGHS: number;
  feePct: number;
  rateGHSUSD: number;
  assetPriceUSD: number;
};

type Withdrawal = {
  id: string;
  asset: string;
  amountAsset: string;
  amountGHS: string;
  method: string;
  destination: string;
  status: string;
  createdAt: string;
};

function WithdrawInner() {
  const { user, loading } = useUser();
  const sp = useSearchParams();
  const { data: portfolio, refresh: refreshPortfolio } = usePoll<Portfolio>(user ? '/api/portfolio' : null, 10000);
  const { data: history, refresh: refreshHistory } = usePoll<{ withdrawals: Withdrawal[] }>(user ? '/api/withdraw' : null, 15000);

  const [asset, setAsset] = useState(sp.get('asset') || 'USDT');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'MOMO' | 'BANK'>('MOMO');
  const [destination, setDestination] = useState('');
  const [destName, setDestName] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const amt = parseFloat(amount) || 0;
  const assets = portfolio?.assets ?? [];
  const selected = assets.find((a) => a.asset === asset);

  useEffect(() => {
    if (!(amt > 0)) {
      setQuote(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/withdraw/quote?asset=${asset}&amount=${amt}`);
        const q = await res.json();
        if (res.ok) setQuote(q);
      } catch {
        /* ignore */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [asset, amt]);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await post<{ netGHS: number; withdrawal: { status: string } }>('/api/withdraw', {
        asset,
        amountAsset: amt,
        method,
        destination,
        destName,
      });
      setMsg({
        ok: true,
        text: `${fmtGHS(res.netGHS)} ${res.withdrawal.status === 'COMPLETED' ? 'sent' : 'is on its way'} to your ${method === 'MOMO' ? 'MoMo' : 'bank account'} via Payteller.`,
      });
      setAmount('');
      refreshPortfolio();
      refreshHistory();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Withdrawal failed' });
    } finally {
      setBusy(false);
    }
  }

  if (!loading && !user) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-2xl font-bold">Withdraw</h1>
        <p className="mt-2 text-muted">Log in to withdraw funds.</p>
        <Link href="/login" className="mt-4 inline-block rounded-lg bg-white px-6 py-2.5 font-semibold text-black">Log in</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pt-8">
      <h1 className="text-2xl font-bold">Withdraw to Ghanaian Cedis</h1>
      <p className="mt-1 text-sm text-muted">
        Cash out <b className="text-white">any crypto directly to MoMo or bank</b> — no need to sell first. Conversion
        and payout are handled automatically via Payteller.
      </p>

      <div className="mt-6 rounded-xl border border-line bg-panel p-6">
        <label className="block">
          <span className="text-sm text-muted">Asset</span>
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-bg px-4 py-3 outline-none focus:border-accent"
          >
            {assets.length === 0 && <option value="USDT">USDT</option>}
            {assets.map((a) => (
              <option key={a.asset} value={a.asset}>
                {a.asset} — available {fmtNum(a.available)}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block">
          <span className="flex justify-between text-sm text-muted">
            Amount ({asset})
            {selected && (
              <button type="button" onClick={() => setAmount(String(selected.available))} className="text-accent hover:underline">
                Max {fmtNum(selected.available)}
              </button>
            )}
          </span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="num mt-1 w-full rounded-lg border border-line bg-bg px-4 py-3 text-lg outline-none focus:border-accent"
          />
        </label>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(
            [
              ['MOMO', 'Mobile Money', '/pay/mtn.svg'],
              ['BANK', 'Bank Account', '/pay/bank.svg'],
            ] as const
          ).map(([id, label, badge]) => (
            <button
              key={id}
              onClick={() => setMethod(id)}
              className={`flex items-center justify-center gap-2 rounded-lg border py-3 text-sm font-semibold ${method === id ? 'border-accent bg-panel2' : 'border-line text-muted hover:border-muted'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={badge} alt="" className="h-6 w-6 rounded" />
              {label}
            </button>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="text-sm text-muted">{method === 'MOMO' ? 'MoMo Number' : 'Bank Account Number'}</span>
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={method === 'MOMO' ? '024 123 4567' : '0123456789012'}
            className="mt-1 w-full rounded-lg border border-line bg-bg px-4 py-3 outline-none focus:border-accent"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-sm text-muted">{method === 'MOMO' ? 'MoMo Account Name' : 'Account Holder Name'}</span>
          <input
            value={destName}
            onChange={(e) => setDestName(e.target.value)}
            placeholder="Full name"
            className="mt-1 w-full rounded-lg border border-line bg-bg px-4 py-3 outline-none focus:border-accent"
          />
        </label>

        {quote && amt > 0 && (
          <div className="num mt-5 space-y-1.5 rounded-lg border border-line bg-bg p-4 text-sm">
            <div className="flex justify-between text-muted">
              <span>{asset} → USD</span>
              <span>${fmtNum(quote.assetPriceUSD * amt, 2)} (@ ${fmtNum(quote.assetPriceUSD, 2)})</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>USD → GH₵ rate</span>
              <span>{quote.rateGHSUSD.toFixed(4)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Fee ({quote.feePct}%)</span>
              <span>-{fmtGHS(quote.feeGHS)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
              <span>You receive</span>
              <span className="text-up">{fmtGHS(quote.netGHS)}</span>
            </div>
          </div>
        )}

        {msg && <p className={`mt-3 text-sm ${msg.ok ? 'text-up' : 'text-down'}`}>{msg.text}</p>}

        <button
          onClick={submit}
          disabled={busy || !(amt > 0) || destination.replace(/\D/g, '').length < 8}
          className="mt-5 w-full rounded-lg bg-white py-3 font-semibold text-black hover:bg-gray-200 disabled:opacity-40"
        >
          {busy ? 'Processing via Payteller…' : 'Withdraw'}
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-panel">
        <div className="border-b border-line px-4 py-3 font-semibold">Withdrawal History</div>
        <table className="w-full text-sm">
          <tbody>
            {(history?.withdrawals ?? []).length === 0 && (
              <tr><td className="py-8 text-center text-muted">No withdrawals yet.</td></tr>
            )}
            {(history?.withdrawals ?? []).map((w) => (
              <tr key={w.id} className="border-t border-line/60">
                <td className="py-2.5 pl-4 text-xs text-muted">{timeAgo(w.createdAt)}</td>
                <td className="num">{fmtNum(Number(w.amountAsset))} {w.asset}</td>
                <td className="num text-up">→ {fmtGHS(Number(w.amountGHS))}</td>
                <td className="text-xs text-muted">{w.method} · {w.destination}</td>
                <td className={`pr-4 text-right text-xs ${w.status === 'COMPLETED' ? 'text-up' : w.status === 'FAILED' ? 'text-down' : 'text-gold'}`}>
                  {w.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function WithdrawPage() {
  return (
    <Suspense>
      <WithdrawInner />
    </Suspense>
  );
}
