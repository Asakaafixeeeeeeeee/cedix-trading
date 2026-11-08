'use client';
import Link from 'next/link';
import { useState } from 'react';
import { post, usePoll, useUser } from '@/lib/hooks';
import { fmtGHS, fmtNum, fmtUSD, timeAgo } from '@/lib/format';
import type { Portfolio } from '@/lib/wallet';

type Tx = {
  id: string;
  type: string;
  status: string;
  asset: string;
  amount: string;
  note: string | null;
  createdAt: string;
};

export default function MobileAssets() {
  const { user, loading } = useUser();
  const { data } = usePoll<Portfolio>(user ? '/api/portfolio' : null, 10000);
  const { data: txData } = usePoll<{ transactions: Tx[] }>(user ? '/api/transactions?limit=20' : null, 15000);
  const [hidden, setHidden] = useState(false);

  async function logout() {
    await post('/api/auth/logout');
    window.location.href = '/m';
  }

  if (!loading && !user) {
    return (
      <div className="px-4 pt-24 text-center">
        <h1 className="text-xl font-bold">My Assets</h1>
        <p className="mt-2 text-sm text-muted">Log in to view your portfolio.</p>
        <Link href="/m/login" className="mt-4 inline-block rounded-xl bg-white px-8 py-3 font-semibold text-black">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">My Assets</h1>
        <button onClick={logout} className="text-xs text-muted">Log out</button>
      </div>

      <div className="mt-3 rounded-2xl bg-gradient-to-br from-[#1a2230] to-panel2 p-5">
        <div className="flex items-center gap-2 text-xs text-muted">
          Total Value <button onClick={() => setHidden((v) => !v)}>{hidden ? '🙈' : '👁'}</button>
        </div>
        <div className="num mt-1 text-3xl font-bold">{hidden ? '••••••' : data ? fmtGHS(data.totalGHS) : '—'}</div>
        <div className="num text-sm text-muted">{hidden ? '' : data ? `≈ ${fmtUSD(data.totalUSD)}` : ''}</div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href="/m/deposit" className="rounded-xl bg-white py-2.5 text-center text-sm font-bold text-black">
            Deposit
          </Link>
          <Link href="/m/withdraw" className="rounded-xl border border-line bg-panel/60 py-2.5 text-center text-sm font-bold">
            Withdraw GH₵
          </Link>
        </div>
      </div>

      <h2 className="mt-5 text-sm font-bold text-muted">Balances</h2>
      <div className="mt-2 space-y-1">
        {(data?.assets ?? []).length === 0 && (
          <div className="rounded-xl bg-panel py-10 text-center text-sm text-muted">No assets yet.</div>
        )}
        {(data?.assets ?? []).map((a) => (
          <div key={a.asset} className="flex items-center justify-between rounded-xl bg-panel px-4 py-3">
            <div>
              <div className="text-sm font-bold">{a.asset}</div>
              <div className="num text-xs text-muted">{hidden ? '•••' : fmtNum(a.total)}</div>
            </div>
            <div className="text-right">
              <div className="num text-sm font-semibold">{hidden ? '•••' : fmtGHS(a.valueGHS)}</div>
              <div className="num text-xs text-muted">{hidden ? '' : fmtUSD(a.valueUSD)}</div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-5 text-sm font-bold text-muted">Recent Activity</h2>
      <div className="mt-2 space-y-1">
        {(txData?.transactions ?? []).map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-xl bg-panel px-4 py-3 text-sm">
            <div className="min-w-0">
              <div className="text-xs font-semibold">{t.type.replace('_', ' ')}</div>
              <div className="truncate text-[11px] text-muted">{t.note ?? timeAgo(t.createdAt)}</div>
            </div>
            <div className="num shrink-0 pl-3 text-right">
              <div className="font-semibold">{fmtNum(Number(t.amount))} {t.asset}</div>
              <div className={`text-[11px] ${t.status === 'COMPLETED' ? 'text-up' : 'text-gold'}`}>{t.status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
