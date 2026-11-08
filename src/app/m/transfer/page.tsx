'use client';
import Link from 'next/link';
import { useState } from 'react';
import { post, usePoll, useUser } from '@/lib/hooks';
import { useDisplayPrefs } from '@/lib/prefs';
import { fmtNum } from '@/lib/format';
import type { Portfolio } from '@/lib/wallet';
import CoinIcon from '@/components/CoinIcon';
import { IconTransfer } from '@/components/icons';

/** Transfer between the Funding (GHS) and Trading (USDT) wallets at the live rate. */
export default function MobileTransfer() {
  const { user, loading } = useUser();
  const { rate } = useDisplayPrefs();
  const { data, refresh } = usePoll<Portfolio>(user ? '/api/portfolio' : null, 10000);
  const [direction, setDirection] = useState<'GHS_TO_USDT' | 'USDT_TO_GHS'>('GHS_TO_USDT');
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const amt = parseFloat(amount) || 0;
  const ghsBal = data?.assets.find((a) => a.asset === 'GHS')?.available ?? 0;
  const usdtBal = data?.assets.find((a) => a.asset === 'USDT')?.available ?? 0;
  const fromGhs = direction === 'GHS_TO_USDT';
  const sourceBal = fromGhs ? ghsBal : usdtBal;
  const received = rate ? (fromGhs ? amt / rate : amt * rate) : 0;

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await post<{ received: number; asset: string }>('/api/transfer', { direction, amount: amt });
      setMsg({ ok: true, text: `Received ${fmtNum(res.received, 2)} ${res.asset}` });
      setAmount('');
      refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Transfer failed' });
    } finally {
      setBusy(false);
    }
  }

  if (!loading && !user) {
    return (
      <div className="px-5 pt-28 text-center text-sm text-muted">
        <Link href="/m/login" className="font-semibold text-accent">Log in</Link> to transfer funds.
      </div>
    );
  }

  const from = fromGhs
    ? { asset: 'GHS', label: 'Funding · GHS', bal: ghsBal }
    : { asset: 'USDT', label: 'Trading · USDT', bal: usdtBal };
  const to = fromGhs
    ? { asset: 'USDT', label: 'Trading · USDT' }
    : { asset: 'GHS', label: 'Funding · GHS' };

  return (
    <div className="px-4 pt-3">
      <div className="flex items-center gap-3 py-2">
        <Link href="/m/assets" className="text-xl text-muted">‹</Link>
        <h1 className="text-[17px] font-bold">Transfer</h1>
      </div>
      <p className="mt-1 text-[13px] text-muted">
        Move value between your Funding (GH₵) and Trading (USDT) wallets at the live exchange rate. No fee.
      </p>

      <div className="relative mt-5">
        <div className="rounded-2xl bg-panel p-4">
          <div className="flex items-center justify-between text-[12px] text-muted">
            <span>From</span>
            <button onClick={() => setAmount(String(sourceBal))} className="font-medium text-accent">
              Max {fmtNum(sourceBal, 2)}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2.5">
            <CoinIcon asset={from.asset} size={32} />
            <span className="text-[14px] font-semibold">{from.label}</span>
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="num mt-3 w-full bg-transparent text-[26px] font-bold outline-none placeholder:text-line"
          />
        </div>

        <button
          onClick={() => { setDirection((d) => (d === 'GHS_TO_USDT' ? 'USDT_TO_GHS' : 'GHS_TO_USDT')); setAmount(''); }}
          className="absolute left-1/2 top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-bg bg-white text-black transition active:rotate-180"
          aria-label="Swap direction"
        >
          <IconTransfer size={18} />
        </button>

        <div className="mt-2 rounded-2xl bg-panel p-4">
          <div className="text-[12px] text-muted">To</div>
          <div className="mt-2 flex items-center gap-2.5">
            <CoinIcon asset={to.asset} size={32} />
            <span className="text-[14px] font-semibold">{to.label}</span>
          </div>
          <div className="num mt-3 text-[26px] font-bold text-muted">
            {amt > 0 && rate ? fmtNum(received, 2) : '0.00'}
          </div>
        </div>
      </div>

      {rate && (
        <div className="num mt-3 text-center text-[12px] text-muted">
          Live rate: 1 USD = {rate.toFixed(4)} GHS
        </div>
      )}
      {msg && <p className={`mt-2 text-center text-sm font-medium ${msg.ok ? 'text-up' : 'text-down'}`}>{msg.text}</p>}

      <button
        onClick={submit}
        disabled={busy || !(amt > 0) || amt > sourceBal + 1e-9}
        className="mt-5 w-full rounded-full bg-white py-3 text-[14px] font-bold text-black transition active:scale-[0.98] disabled:opacity-40"
      >
        {busy ? 'Transferring…' : 'Transfer'}
      </button>
    </div>
  );
}
