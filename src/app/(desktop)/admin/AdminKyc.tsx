'use client';
import { useState } from 'react';
import { post, usePoll } from '@/lib/hooks';
import { timeAgo } from '@/lib/format';

type App = {
  id: string;
  status: string;
  legalName: string;
  dob: string;
  country: string;
  address: string;
  idType: string;
  idNumber: string;
  docFront: string;
  docBack: string;
  selfie: string;
  note: string | null;
  createdAt: string;
  user: { username: string; email: string; kycLevel: number };
};

const COLOR: Record<string, string> = {
  PENDING: 'bg-gold/15 text-gold',
  APPROVED: 'bg-up/15 text-up',
  REJECTED: 'bg-down/15 text-down',
  INFO_REQUIRED: 'bg-accent/15 text-accent',
};

export default function AdminKyc() {
  const [filter, setFilter] = useState('PENDING');
  const { data, refresh } = usePoll<{ applications: App[] }>(`/api/admin/kyc${filter ? `?status=${filter}` : ''}`, 15000);
  const [selected, setSelected] = useState<App | null>(null);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {['PENDING', 'APPROVED', 'REJECTED', 'INFO_REQUIRED', ''].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium ${filter === s ? 'bg-panel2 text-foreground' : 'text-muted'}`}
          >
            {s ? s.replace('_', ' ') : 'All'}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {(data?.applications ?? []).length === 0 && (
          <div className="rounded-xl border border-line bg-panel py-12 text-center text-muted">No applications.</div>
        )}
        {(data?.applications ?? []).map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="font-bold">{a.legalName}</div>
              <div className="text-xs text-muted">@{a.user.username} · {a.user.email} · {a.idType.replace(/_/g, ' ')} · {timeAgo(a.createdAt)}</div>
            </div>
            <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${COLOR[a.status]}`}>{a.status.replace('_', ' ')}</span>
            <button onClick={() => setSelected(a)} className="rounded-lg border border-line px-3.5 py-1.5 text-xs font-medium hover:border-accent">
              Review
            </button>
          </div>
        ))}
      </div>
      {selected && <ReviewModal app={selected} onClose={() => setSelected(null)} onDone={() => { setSelected(null); refresh(); }} />}
    </div>
  );
}

function ReviewModal({ app, onClose, onDone }: { app: App; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function decide(decision: string) {
    setBusy(true);
    setError('');
    try {
      await post(`/api/admin/kyc/${app.id}`, { decision, note });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-bg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">KYC Review — {app.legalName}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">✕</button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl bg-panel p-4 text-sm">
          <div><span className="text-muted">User:</span> @{app.user.username} ({app.user.email})</div>
          <div><span className="text-muted">Country:</span> {app.country}</div>
          <div><span className="text-muted">Date of birth:</span> {new Date(app.dob).toLocaleDateString()}</div>
          <div><span className="text-muted">Document:</span> {app.idType.replace(/_/g, ' ')}</div>
          <div className="num"><span className="text-muted">ID number:</span> {app.idNumber}</div>
          <div className="col-span-2"><span className="text-muted">Address:</span> {app.address}</div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ['Front', app.docFront],
            ['Back', app.docBack],
            ['Live selfie', app.selfie],
          ].map(([label, file]) => (
            <div key={label} className="rounded-xl border border-line bg-panel p-2">
              <div className="mb-1.5 px-1 text-xs font-semibold text-muted">{label}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/kyc/file/${file}`} alt={label} className="h-44 w-full rounded-lg object-contain" />
            </div>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm text-muted">Review note (required for reject / info request)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent" />
        </label>
        {error && <p className="mt-2 text-sm text-down">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => decide('APPROVED')} className="rounded-full bg-up px-6 py-2.5 text-sm font-bold text-[#ffffff] disabled:opacity-40">
            Approve
          </button>
          <button disabled={busy} onClick={() => decide('INFO_REQUIRED')} className="rounded-full border border-accent px-6 py-2.5 text-sm font-bold text-accent disabled:opacity-40">
            Request more info
          </button>
          <button disabled={busy} onClick={() => decide('REJECTED')} className="rounded-full border border-down px-6 py-2.5 text-sm font-bold text-down disabled:opacity-40">
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
