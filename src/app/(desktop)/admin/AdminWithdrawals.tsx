'use client';
import { useState } from 'react';
import { post, usePoll } from '@/lib/hooks';
import { fmtGHS, fmtNum } from '@/lib/format';

type Wd = {
  id: string;
  asset: string;
  amountAsset: string;
  amountUSD: string;
  amountGHS: string;
  method: string;
  destination: string;
  destName: string | null;
  status: string;
  reviewNote: string | null;
  providerRef: string | null;
  createdAt: string;
  user: { username: string; email: string; kycLevel: number };
};
type Data = { withdrawals: Wd[]; counts: Record<string, number> };

const GROUPS: [string, string[]][] = [
  ['Pending review', ['PENDING_REVIEW', 'PROCESSING']],
  ['Approved — awaiting payment', ['APPROVED']],
  ['Payment sent', ['PAYMENT_SENT']],
  ['Completed', ['COMPLETED']],
  ['Rejected / failed', ['REJECTED', 'FAILED', 'CANCELLED']],
];

const dt = (s: string) => new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const reference = (id: string) => `CEDIX-${id.slice(-8).toUpperCase()}`;

export default function AdminWithdrawals() {
  const { data, refresh } = usePoll<Data>('/api/admin/withdrawals', 15000);
  const [group, setGroup] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function act(id: string, action: string, extra?: Record<string, string>) {
    setBusy(id);
    setError('');
    try {
      await post('/api/admin/withdrawals', { id, action, ...extra }, 'PATCH');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <p className="py-10 text-center text-sm text-muted">Loading withdrawals…</p>;

  const statuses = GROUPS[group][1];
  const list = data.withdrawals.filter((w) => statuses.includes(w.status));

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {GROUPS.map(([label, keys], i) => {
          const count = keys.reduce((s, k) => s + (data.counts[k] ?? 0), 0);
          return (
            <button
              key={label}
              onClick={() => setGroup(i)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${group === i ? 'bg-white text-black' : 'bg-panel text-muted'}`}
            >
              {label} {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {error && <p className="mb-3 text-xs text-down">{error}</p>}

      <div className="space-y-3">
        {list.map((w) => (
          <div key={w.id} className="rounded-xl border border-line bg-panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">
                  {w.user.username} <span className="font-normal text-muted">({w.user.email})</span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {dt(w.createdAt)} · Ref <span className="select-all text-white">{reference(w.id)}</span> · KYC L{w.user.kycLevel}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  w.status === 'COMPLETED'
                    ? 'bg-up/15 text-up'
                    : ['REJECTED', 'FAILED', 'CANCELLED'].includes(w.status)
                      ? 'bg-down/15 text-down'
                      : 'bg-gold/15 text-gold'
                }`}
              >
                {w.status.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs md:grid-cols-4">
              <p><span className="text-muted">Amount: </span>{fmtNum(Number(w.amountAsset))} {w.asset}</p>
              <p><span className="text-muted">USD: </span>${Number(w.amountUSD).toFixed(2)}</p>
              <p><span className="text-muted">Pays out: </span>{fmtGHS(Number(w.amountGHS))}</p>
              <p><span className="text-muted">Method: </span>{w.method}</p>
              <p className="col-span-2"><span className="text-muted">Recipient: </span>{w.destination}{w.destName ? ` (${w.destName})` : ''}</p>
              {w.providerRef && <p className="col-span-2"><span className="text-muted">Provider ref: </span>{w.providerRef}</p>}
              {w.reviewNote && <p className="col-span-2"><span className="text-muted">Note: </span>{w.reviewNote}</p>}
            </div>

            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {['PENDING_REVIEW', 'PROCESSING'].includes(w.status) && (
                <>
                  <button
                    disabled={busy === w.id}
                    onClick={() => act(w.id, 'approve')}
                    className="rounded-lg bg-up px-4 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    disabled={busy === w.id}
                    onClick={() => {
                      const reason = prompt('Rejection reason (required, shown to the user):');
                      if (reason) act(w.id, 'reject', { reason });
                    }}
                    className="rounded-lg bg-down/15 px-4 py-1.5 text-xs font-semibold text-down disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              )}
              {w.status === 'APPROVED' && (
                <>
                  <button
                    disabled={busy === w.id}
                    onClick={() => {
                      const ref = prompt(`Pay ${fmtGHS(Number(w.amountGHS))} to ${w.destination} via ${w.method}, then enter the provider transaction reference:`);
                      if (ref) act(w.id, 'mark-sent', { providerRef: ref });
                    }}
                    className="rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
                  >
                    Record payment sent
                  </button>
                  <button
                    disabled={busy === w.id}
                    onClick={() => {
                      const reason = prompt('Rejection reason (required, funds will be refunded):');
                      if (reason) act(w.id, 'reject', { reason });
                    }}
                    className="rounded-lg bg-down/15 px-4 py-1.5 text-xs font-semibold text-down disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              )}
              {w.status === 'PAYMENT_SENT' && (
                <button
                  disabled={busy === w.id}
                  onClick={() => {
                    if (confirm('Confirm the provider has completed this transfer?')) act(w.id, 'complete');
                  }}
                  className="rounded-lg bg-up px-4 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
                >
                  Confirm completed
                </button>
              )}
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <p className="rounded-xl border border-line bg-panel py-10 text-center text-xs text-muted">
            No withdrawals in this group.
          </p>
        )}
      </div>
    </div>
  );
}
