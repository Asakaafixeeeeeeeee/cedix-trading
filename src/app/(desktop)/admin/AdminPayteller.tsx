'use client';
import { useState } from 'react';
import { post, usePoll } from '@/lib/hooks';
import { fmtGHS, fmtNum } from '@/lib/format';

type Payment = {
  id: string;
  gatewayRef: string | null;
  asset: string;
  amountGHS: string;
  amountAsset: string;
  method: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  user: { username: string; email: string };
};

type Data = {
  mode: 'live' | 'sandbox';
  merchantId: string | null;
  webhookConfigured: boolean;
  payments: Payment[];
  stats: {
    todayTotalGHS: number;
    todaySuccessCount: number;
    todayStartedCount: number;
    byStatus: Record<string, number>;
  };
  recentEvents: { id: string; type: string; reference: string | null; createdAt: string }[];
};

const STATUSES = ['', 'COMPLETED', 'AWAITING_PAYMENT', 'PROCESSING', 'FAILED', 'CANCELLED', 'INITIATED'];

const statusColor = (s: string) =>
  s === 'COMPLETED' ? 'text-up' : ['FAILED', 'CANCELLED'].includes(s) ? 'text-down' : 'text-gold';

const dt = (s: string) => new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function AdminPayteller() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [testResult, setTestResult] = useState('');
  const [testing, setTesting] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [note, setNote] = useState('');

  const { data, refresh } = usePoll<Data>(
    `/api/admin/payteller?status=${encodeURIComponent(status)}&q=${encodeURIComponent(query)}`,
    15000,
  );

  async function reconcile(intentId: string) {
    const reason = prompt('Reason for this reconciliation (required). The payment will be verified with Payteller before any credit is made:');
    if (!reason || reason.trim().length < 4) return;
    setBusyId(intentId);
    setNote('');
    try {
      const r = await post<{ ok: boolean; result: string; providerRef: string | null }>('/api/admin/payteller', { action: 'reconcile', intentId, reason: reason.trim() });
      setNote(r.result === 'credited' ? `Verified and credited (ref ${r.providerRef ?? '—'}).` : `Done: ${r.result}.`);
      refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Reconciliation failed');
    } finally {
      setBusyId('');
    }
  }

  async function testCreds() {
    setTesting(true);
    setTestResult('');
    try {
      const r = await post<{ ok: boolean; detail: string }>('/api/admin/payteller', { action: 'test-credentials' });
      setTestResult(`${r.ok ? 'OK' : 'FAILED'} — ${r.detail}`);
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  }

  if (!data) return <p className="py-10 text-center text-sm text-muted">Loading payments…</p>;

  const cards: [string, string][] = [
    ['Deposits today (GHS)', fmtGHS(data.stats.todayTotalGHS)],
    ['Successful today', String(data.stats.todaySuccessCount)],
    ['Started today', String(data.stats.todayStartedCount)],
    ['Pending (all time)', String((data.stats.byStatus.AWAITING_PAYMENT ?? 0) + (data.stats.byStatus.PROCESSING ?? 0) + (data.stats.byStatus.INITIATED ?? 0))],
    ['Failed (all time)', String((data.stats.byStatus.FAILED ?? 0) + (data.stats.byStatus.CANCELLED ?? 0))],
  ];

  return (
    <div>
      {/* Gateway status */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${data.mode === 'live' ? 'bg-up/15 text-up' : 'bg-gold/15 text-gold'}`}>
          {data.mode === 'live' ? 'LIVE' : 'SANDBOX'}
        </span>
        <span className="text-xs text-muted">
          Merchant: <span className="text-white">{data.merchantId ?? 'not configured'}</span>
        </span>
        <span className="text-xs text-muted">
          Webhook secret: <span className="text-white">{data.webhookConfigured ? 'configured' : 'missing'}</span>
        </span>
        <span className="text-xs text-muted">
          Webhook URL: <span className="select-all text-white">https://cedixtrading.com/api/webhooks/payteller</span>
        </span>
        <button
          onClick={testCreds}
          disabled={testing || data.mode !== 'live'}
          className="ml-auto rounded-lg bg-panel2 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {testing ? 'Testing…' : 'Test credentials'}
        </button>
        {testResult && <span className="w-full text-xs text-muted">{testResult}</span>}
        {note && <span className="w-full rounded-lg bg-panel2 px-3 py-2 text-xs font-medium text-white">{note}</span>}
      </div>

      {/* Totals */}
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-panel px-3 py-2.5">
            <p className="text-[11px] text-muted">{label}</p>
            <p className="mt-0.5 text-[15px] font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(q);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email, username or reference"
            className="w-64 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs outline-none"
          />
          <button className="rounded-lg bg-panel2 px-3 py-1.5 text-xs font-medium text-white">Search</button>
        </form>
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setStatus(s)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${status === s ? 'bg-white text-black' : 'bg-panel text-muted'}`}
            >
              {s === '' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Payments table */}
      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2.5 pl-4 font-medium">Date / time</th>
              <th className="font-medium">Customer</th>
              <th className="font-medium">Amount</th>
              <th className="font-medium">Receives</th>
              <th className="font-medium">Method</th>
              <th className="font-medium">Reference</th>
              <th className="font-medium">Gateway ref</th>
              <th className="font-medium">Status</th>
              <th className="pr-4 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {data.payments.map((p) => (
              <tr key={p.id} className="border-t border-line text-xs">
                <td className="py-2.5 pl-4 text-muted">{dt(p.createdAt)}</td>
                <td>
                  <p className="font-medium">{p.user.username}</p>
                  <p className="text-muted">{p.user.email}</p>
                </td>
                <td className="font-medium">{fmtGHS(Number(p.amountGHS))}</td>
                <td>
                  {fmtNum(Number(p.amountAsset))} {p.asset}
                </td>
                <td className="text-muted">{p.method}</td>
                <td className="max-w-[130px] truncate text-muted" title={p.id}>{p.id}</td>
                <td className="max-w-[130px] truncate text-muted" title={p.gatewayRef ?? ''}>{p.gatewayRef ?? '—'}</td>
                <td className={`font-medium ${statusColor(p.status)}`}>{p.status.replace('_', ' ')}</td>
                <td className="pr-4">
                  {p.status !== 'COMPLETED' && p.status !== 'FAILED' && p.status !== 'CANCELLED' ? (
                    <button
                      onClick={() => reconcile(p.id)}
                      disabled={busyId === p.id}
                      className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-black disabled:opacity-40"
                      title="Verify with Payteller and credit if the payment succeeded"
                    >
                      {busyId === p.id ? '…' : 'Verify & credit'}
                    </button>
                  ) : (
                    <span className="text-[11px] text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {data.payments.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-xs text-muted">
                  No payments match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Webhook deliveries */}
      <h3 className="mt-6 text-sm font-semibold">Recent webhook events</h3>
      <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2.5 pl-4 font-medium">Received</th>
              <th className="font-medium">Event ID</th>
              <th className="font-medium">Type</th>
              <th className="pr-4 font-medium">Reference</th>
            </tr>
          </thead>
          <tbody>
            {data.recentEvents.map((ev) => (
              <tr key={ev.id} className="border-t border-line text-xs">
                <td className="py-2 pl-4 text-muted">{dt(ev.createdAt)}</td>
                <td className="max-w-[200px] truncate text-muted" title={ev.id}>{ev.id}</td>
                <td className={ev.type === 'payment.successful' ? 'text-up' : ev.type === 'payment.failed' ? 'text-down' : 'text-muted'}>
                  {ev.type}
                </td>
                <td className="max-w-[160px] truncate pr-4 text-muted">{ev.reference ?? '—'}</td>
              </tr>
            ))}
            {data.recentEvents.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-xs text-muted">
                  No webhook deliveries yet. Configure the Destination URL in your Payteller dashboard.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
