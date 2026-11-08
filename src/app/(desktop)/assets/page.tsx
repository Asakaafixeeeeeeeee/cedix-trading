'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usePoll, useUser } from '@/lib/hooks';
import { fmtGHS, fmtNum, fmtUSD, timeAgo } from '@/lib/format';
import type { Portfolio } from '@/lib/wallet';

type Tx = {
  id: string;
  type: string;
  status: string;
  asset: string;
  amount: string;
  fee: string;
  note: string | null;
  createdAt: string;
};

const TX_COLORS: Record<string, string> = {
  DEPOSIT: 'text-up',
  WITHDRAWAL: 'text-down',
  TRADE_BUY: 'text-up',
  TRADE_SELL: 'text-down',
  P2P_BUY: 'text-up',
  P2P_SELL: 'text-down',
  EARN_INTEREST: 'text-gold',
};

export default function AssetsPage() {
  const { user, loading } = useUser();
  const { data } = usePoll<Portfolio>(user ? '/api/portfolio' : null, 10000);
  const { data: txData } = usePoll<{ transactions: Tx[] }>(user ? '/api/transactions' : null, 15000);
  const [hidden, setHidden] = useState(false);

  if (!loading && !user) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-2xl font-bold">My Assets</h1>
        <p className="mt-2 text-muted">Log in to view your portfolio.</p>
        <Link href="/login" className="mt-4 inline-block rounded-lg bg-white px-6 py-2.5 font-semibold text-black">Log in</Link>
      </div>
    );
  }

  return (
    <div className="pt-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            My Assets
            <button onClick={() => setHidden((v) => !v)} className="text-base text-muted hover:text-white">{hidden ? '🙈' : '👁'}</button>
          </h1>
          <div className="num mt-2 text-3xl font-bold">{hidden ? '••••••' : data ? fmtUSD(data.totalUSD) : '—'}</div>
          <div className="num text-muted">{hidden ? '' : data ? `≈ ${fmtGHS(data.totalGHS)}` : ''}</div>
        </div>
        <div className="flex gap-3">
          <Link href="/deposit" className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-gray-200">Deposit</Link>
          <Link href="/withdraw" className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold hover:border-accent">Withdraw to GH₵</Link>
          <Link href="/p2p" className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold hover:border-accent">P2P</Link>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-panel">
        <div className="border-b border-line px-4 py-3 font-semibold">Balances</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2 pl-4 font-medium">Asset</th>
              <th className="font-medium">Available</th>
              <th className="font-medium">In Orders</th>
              <th className="hidden font-medium md:table-cell">Price (USD)</th>
              <th className="font-medium">Value (USD)</th>
              <th className="hidden font-medium md:table-cell">Value (GH₵)</th>
              <th className="pr-4 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {(data?.assets ?? []).length === 0 && (
              <tr><td colSpan={7} className="py-10 text-center text-muted">No assets yet — make your first deposit.</td></tr>
            )}
            {(data?.assets ?? []).map((a) => (
              <tr key={a.asset} className="border-t border-line/60">
                <td className="py-3 pl-4 font-semibold">{a.asset}</td>
                <td className="num">{hidden ? '•••' : fmtNum(a.available)}</td>
                <td className="num text-muted">{hidden ? '•••' : fmtNum(a.locked)}</td>
                <td className="num hidden text-muted md:table-cell">{fmtUSD(a.priceUSD)}</td>
                <td className="num">{hidden ? '•••' : fmtUSD(a.valueUSD)}</td>
                <td className="num hidden text-muted md:table-cell">{hidden ? '•••' : fmtGHS(a.valueGHS)}</td>
                <td className="pr-4 text-right">
                  {a.asset !== 'GHS' && a.asset !== 'USDT' && (
                    <Link href={`/trade/${a.asset}USDT`} className="mr-2 text-xs text-accent hover:underline">Trade</Link>
                  )}
                  <Link href={`/withdraw?asset=${a.asset}`} className="text-xs text-accent hover:underline">Withdraw</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-panel">
        <div className="border-b border-line px-4 py-3 font-semibold">Transaction History</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2 pl-4 font-medium">Time</th>
              <th className="font-medium">Type</th>
              <th className="font-medium">Asset</th>
              <th className="font-medium">Amount</th>
              <th className="hidden font-medium lg:table-cell">Details</th>
              <th className="pr-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(txData?.transactions ?? []).length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-muted">No transactions yet.</td></tr>
            )}
            {(txData?.transactions ?? []).map((t) => (
              <tr key={t.id} className="border-t border-line/60">
                <td className="py-2.5 pl-4 text-xs text-muted">{timeAgo(t.createdAt)}</td>
                <td className={`text-xs font-semibold ${TX_COLORS[t.type] ?? ''}`}>{t.type.replace('_', ' ')}</td>
                <td className="font-medium">{t.asset}</td>
                <td className="num">{fmtNum(Number(t.amount))}</td>
                <td className="hidden max-w-md truncate text-xs text-muted lg:table-cell">{t.note}</td>
                <td className={`pr-4 text-xs ${t.status === 'COMPLETED' ? 'text-up' : t.status === 'FAILED' ? 'text-down' : 'text-gold'}`}>
                  {t.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
