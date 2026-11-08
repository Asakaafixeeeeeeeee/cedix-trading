'use client';
import { useState } from 'react';
import { post, usePoll } from '@/lib/hooks';
import { fmtGHS, fmtNum, timeAgo } from '@/lib/format';

type Dep = {
  id: string;
  asset: string;
  amountGHS: string;
  amountAsset: string;
  method: string;
  status: string;
  createdAt: string;
  user: { username: string; email: string };
};

type Wd = Dep & { destination: string };

type Tx = {
  id: string;
  type: string;
  status: string;
  asset: string;
  amount: string;
  note: string | null;
  createdAt: string;
  user: { username: string };
};

const statusColor = (s: string) =>
  s === 'COMPLETED' ? 'text-up' : ['FAILED', 'CANCELLED'].includes(s) ? 'text-down' : 'text-gold';

export default function AdminFinance() {
  const { data, refresh } = usePoll<{ deposits: Dep[]; withdrawals: Wd[] }>('/api/admin/finance', 15000);
  const { data: txData } = usePoll<{ transactions: Tx[] }>('/api/admin/transactions', 20000);
  const [sub, setSub] = useState<'deposits' | 'withdrawals' | 'transactions'>('deposits');
  const [busy, setBusy] = useState<string | null>(null);

  async function override(kind: 'deposit' | 'withdrawal', id: string, status: string) {
    if (!confirm(`Set ${kind} ${status}?`)) return;
    setBusy(id);
    try {
      await post('/api/admin/finance', { kind, id, status }, 'PATCH');
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(['deposits', 'withdrawals', 'transactions'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSub(s)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${sub === s ? 'bg-panel2 text-white' : 'text-muted hover:text-white'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {sub !== 'transactions' && (
        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2.5 pl-4 font-medium">Time</th>
                <th className="font-medium">User</th>
                <th className="font-medium">Amount</th>
                <th className="font-medium">{sub === 'deposits' ? 'Receives' : 'Pays out'}</th>
                <th className="font-medium">Method</th>
                <th className="font-medium">Status</th>
                <th className="pr-4 text-right font-medium">Override</th>
              </tr>
            </thead>
            <tbody>
              {(sub === 'deposits' ? data?.deposits : data?.withdrawals)?.map((d) => (
                <tr key={d.id} className="border-t border-line/60">
                  <td className="py-2.5 pl-4 text-xs text-muted">{timeAgo(d.createdAt)}</td>
                  <td>
                    <div className="font-medium">{d.user.username}</div>
                    <div className="text-xs text-muted">{d.user.email}</div>
                  </td>
                  <td className="num">{sub === 'deposits' ? fmtGHS(Number(d.amountGHS)) : `${fmtNum(Number(d.amountAsset))} ${d.asset}`}</td>
                  <td className="num">
                    {sub === 'deposits' ? `${fmtNum(Number(d.amountAsset))} ${d.asset}` : fmtGHS(Number(d.amountGHS))}
                    {sub === 'withdrawals' && <div className="text-xs text-muted">→ {(d as Wd).destination}</div>}
                  </td>
                  <td className="text-xs">{d.method}</td>
                  <td className={`text-xs font-semibold ${statusColor(d.status)}`}>{d.status}</td>
                  <td className="pr-4 text-right">
                    {!['COMPLETED', 'CANCELLED'].includes(d.status) && (
                      <div className="flex justify-end gap-1.5">
                        <button
                          disabled={busy === d.id}
                          onClick={() => override(sub === 'deposits' ? 'deposit' : 'withdrawal', d.id, 'COMPLETED')}
                          className="rounded border border-up/50 px-2 py-1 text-[11px] text-up disabled:opacity-40"
                        >
                          Complete
                        </button>
                        <button
                          disabled={busy === d.id}
                          onClick={() => override(sub === 'deposits' ? 'deposit' : 'withdrawal', d.id, 'FAILED')}
                          className="rounded border border-down/50 px-2 py-1 text-[11px] text-down disabled:opacity-40"
                        >
                          Fail{sub === 'withdrawals' ? ' + refund' : ''}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {((sub === 'deposits' ? data?.deposits : data?.withdrawals) ?? []).length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-muted">None yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {sub === 'transactions' && (
        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2.5 pl-4 font-medium">Time</th>
                <th className="font-medium">User</th>
                <th className="font-medium">Type</th>
                <th className="font-medium">Amount</th>
                <th className="hidden font-medium lg:table-cell">Note</th>
                <th className="pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(txData?.transactions ?? []).map((t) => (
                <tr key={t.id} className="border-t border-line/60">
                  <td className="py-2 pl-4 text-xs text-muted">{timeAgo(t.createdAt)}</td>
                  <td className="text-xs font-medium">{t.user.username}</td>
                  <td className="text-xs">{t.type}</td>
                  <td className="num">{fmtNum(Number(t.amount))} {t.asset}</td>
                  <td className="hidden max-w-sm truncate text-xs text-muted lg:table-cell">{t.note}</td>
                  <td className={`pr-4 text-xs ${statusColor(t.status)}`}>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
