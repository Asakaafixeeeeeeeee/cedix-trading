'use client';
import Link from 'next/link';
import { usePoll, useUser } from '@/lib/hooks';
import { fmtNum, timeAgo } from '@/lib/format';

type Tx = {
  id: string;
  type: string;
  status: string;
  asset: string;
  amount: string;
  note: string | null;
  createdAt: string;
};

const COLOR: Record<string, string> = {
  DEPOSIT: 'text-up', TRADE_BUY: 'text-up', P2P_BUY: 'text-up', EARN_INTEREST: 'text-up', UNSTAKE: 'text-up',
  WITHDRAWAL: 'text-down', TRADE_SELL: 'text-down', P2P_SELL: 'text-down', STAKE: 'text-down',
};

export default function MobileHistory() {
  const { user, loading } = useUser();
  const { data } = usePoll<{ transactions: Tx[] }>(user ? '/api/transactions?limit=100' : null, 15000);

  if (!loading && !user) {
    return (
      <div className="px-5 pt-28 text-center text-sm text-muted">
        <Link href="/m/login" className="font-semibold text-accent">Log in</Link> to view your history.
      </div>
    );
  }

  return (
    <div className="px-4 pt-3">
      <div className="flex items-center gap-3 py-2">
        <Link href="/m/assets" className="text-xl text-muted">‹</Link>
        <h1 className="text-lg font-bold">Transaction History</h1>
      </div>
      <div className="mt-2">
        {(data?.transactions ?? []).length === 0 && (
          <div className="rounded-2xl bg-panel py-14 text-center text-sm text-muted">No transactions yet.</div>
        )}
        {(data?.transactions ?? []).map((t) => (
          <div key={t.id} className="flex items-center gap-3 border-b border-line/60 py-3.5 last:border-0">
            <div className="min-w-0 flex-1">
              <div className={`text-[13px] font-bold ${COLOR[t.type] ?? ''}`}>{t.type.replace(/_/g, ' ')}</div>
              <div className="mt-0.5 truncate text-[12px] text-muted">{t.note ?? '—'}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="num text-[14px] font-bold">{fmtNum(Number(t.amount))} {t.asset}</div>
              <div className="num text-[11px] text-muted">
                {timeAgo(t.createdAt)} · <span className={t.status === 'COMPLETED' ? 'text-up' : t.status === 'FAILED' ? 'text-down' : 'text-gold'}>{t.status}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
