'use client';
import Link from 'next/link';
import { usePoll, useUser } from '@/lib/hooks';
import { fmtGHS, fmtNum } from '@/lib/format';

type Wd = {
  id: string;
  asset: string;
  amountAsset: string;
  amountGHS: string;
  method: string;
  destination: string;
  status: string;
  reviewNote: string | null;
  providerRef: string | null;
  createdAt: string;
};

const LABELS: Record<string, [string, string]> = {
  PENDING_REVIEW: ['Pending Review', 'text-gold'],
  PROCESSING: ['Pending Review', 'text-gold'],
  APPROVED: ['Approved — Awaiting Payment', 'text-gold'],
  PAYMENT_SENT: ['Payment Sent', 'text-up'],
  COMPLETED: ['Completed', 'text-up'],
  REJECTED: ['Rejected', 'text-down'],
  FAILED: ['Failed', 'text-down'],
  CANCELLED: ['Cancelled', 'text-down'],
};

const dt = (s: string) =>
  new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function MobileWithdrawals() {
  const { user, loading } = useUser();
  const { data } = usePoll<{ withdrawals: Wd[] }>(user ? '/api/withdraw' : null, 10000);

  if (!loading && !user) {
    return (
      <div className="px-4 pt-24 text-center">
        <p className="text-sm text-muted">Log in to view withdrawals.</p>
        <Link href="/m/login" className="mt-3 inline-block rounded-xl bg-white px-8 py-3 font-semibold text-black">Log in</Link>
      </div>
    );
  }

  return (
    <div className="px-4 pb-24 pt-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[17px] font-bold">Withdrawal Status</h1>
        <Link href="/m/withdraw" className="text-xs text-accent">New withdrawal</Link>
      </div>

      <div className="mt-4 space-y-2.5">
        {!data ? (
          <p className="py-10 text-center text-xs text-muted">Loading…</p>
        ) : data.withdrawals.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted">No withdrawal requests yet.</p>
        ) : (
          data.withdrawals.map((w) => {
            const [label, color] = LABELS[w.status] ?? [w.status, 'text-muted'];
            return (
              <div key={w.id} className="rounded-xl border border-line bg-panel p-3.5">
                <div className="flex items-baseline justify-between">
                  <p className="text-[13px] font-semibold">{fmtGHS(Number(w.amountGHS))}</p>
                  <span className={`text-[11px] font-semibold ${color}`}>{label}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted">
                  {fmtNum(Number(w.amountAsset))} {w.asset} → {w.method === 'MOMO' ? 'MoMo' : 'Bank'} {w.destination}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {dt(w.createdAt)} · Ref CEDIX-{w.id.slice(-8).toUpperCase()}
                </p>
                {w.providerRef && <p className="mt-0.5 text-[11px] text-muted">Payment reference: {w.providerRef}</p>}
                {w.status === 'REJECTED' && w.reviewNote && (
                  <p className="mt-1 text-[11px] text-down">Reason: {w.reviewNote} — funds returned to your wallet.</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
