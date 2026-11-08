'use client';
import { useEffect, useState } from 'react';
import { post, usePoll } from '@/lib/hooks';
import { timeAgo } from '@/lib/format';

type Settings = {
  fx_margin_pct?: number;
  fx_override?: number | null;
  trading_fee_pct?: number;
  withdrawal_fee_pct?: number;
  payteller?: { mode: string; merchantId: string; configured: boolean };
};

type Log = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
  admin: { username: string };
};

export default function AdminSettings() {
  const { data, refresh } = usePoll<{ settings: Settings }>('/api/admin/settings', 0);
  const { data: fx } = usePoll<{ rate: number; baseRate: number; source: string }>('/api/fx', 30000);
  const { data: audit } = usePoll<{ logs: Log[] }>('/api/admin/audit', 30000);
  const [form, setForm] = useState({ fx_margin_pct: '', fx_override: '', trading_fee_pct: '', withdrawal_fee_pct: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = data?.settings;
    if (s) {
      setForm({
        fx_margin_pct: String(s.fx_margin_pct ?? 0),
        fx_override: s.fx_override != null && typeof s.fx_override === 'number' ? String(s.fx_override) : '',
        trading_fee_pct: String(s.trading_fee_pct ?? 0.1),
        withdrawal_fee_pct: String(s.withdrawal_fee_pct ?? 1),
      });
    }
  }, [data]);

  async function save() {
    setBusy(true);
    setMsg('');
    try {
      await post(
        '/api/admin/settings',
        {
          fx_margin_pct: parseFloat(form.fx_margin_pct) || 0,
          fx_override: form.fx_override ? parseFloat(form.fx_override) : null,
          trading_fee_pct: parseFloat(form.trading_fee_pct) || 0,
          withdrawal_fee_pct: parseFloat(form.withdrawal_fee_pct) || 0,
        },
        'PATCH',
      );
      setMsg('Settings saved ✓');
      refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  const input = 'num mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-panel p-5">
        <h3 className="font-semibold">💱 Exchange Rate & Fees</h3>
        <p className="mt-1 text-xs text-muted">
          Live rate: {fx ? `1 USD = ${fx.baseRate.toFixed(4)} GHS (${fx.source})` : '…'} · Effective:{' '}
          {fx ? fx.rate.toFixed(4) : '…'} GHS
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <label className="text-sm text-muted">
            FX margin (%) on live rate
            <input value={form.fx_margin_pct} onChange={(e) => setForm((f) => ({ ...f, fx_margin_pct: e.target.value }))} type="number" className={input} />
          </label>
          <label className="text-sm text-muted">
            FX override (GHS/USD, empty = live)
            <input value={form.fx_override} onChange={(e) => setForm((f) => ({ ...f, fx_override: e.target.value }))} type="number" placeholder="live" className={input} />
          </label>
          <label className="text-sm text-muted">
            Trading fee (%)
            <input value={form.trading_fee_pct} onChange={(e) => setForm((f) => ({ ...f, trading_fee_pct: e.target.value }))} type="number" className={input} />
          </label>
          <label className="text-sm text-muted">
            Withdrawal fee (%)
            <input value={form.withdrawal_fee_pct} onChange={(e) => setForm((f) => ({ ...f, withdrawal_fee_pct: e.target.value }))} type="number" className={input} />
          </label>
        </div>
        <button onClick={save} disabled={busy} className="mt-4 rounded-lg bg-white px-5 py-2 text-sm font-semibold text-black disabled:opacity-40">
          {busy ? 'Saving…' : 'Save Settings'}
        </button>
        {msg && <span className={`ml-3 text-sm ${msg.includes('✓') ? 'text-up' : 'text-down'}`}>{msg}</span>}

        <h3 className="mt-8 font-semibold">💳 Payteller Gateway</h3>
        <div className="mt-2 rounded-lg border border-line bg-bg p-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-muted">Mode</span>
            <span className={data?.settings?.payteller?.configured ? 'text-up' : 'text-gold'}>
              {data?.settings?.payteller?.configured ? 'LIVE' : 'SANDBOX'}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted">
            To go live, set <code className="text-foreground">PAYTELLER_BASE_URL</code>,{' '}
            <code className="text-foreground">PAYTELLER_API_KEY</code> and{' '}
            <code className="text-foreground">PAYTELLER_MERCHANT_ID</code> in the server environment and restart.
            Until then all payments run through the built-in sandbox gateway.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-panel p-5">
        <h3 className="font-semibold">📜 Admin Audit Log</h3>
        <div className="mt-3 max-h-[480px] space-y-2 overflow-y-auto">
          {(audit?.logs ?? []).map((l) => (
            <div key={l.id} className="rounded-lg border border-line/60 bg-bg px-3 py-2 text-xs">
              <span className="font-semibold text-gold">@{l.admin.username}</span>{' '}
              <span className="text-foreground">{l.action}</span>
              {l.targetType && <span className="text-muted"> · {l.targetType} {l.targetId?.slice(0, 10)}</span>}
              <span className="float-right text-muted">{timeAgo(l.createdAt)}</span>
            </div>
          ))}
          {(audit?.logs ?? []).length === 0 && <div className="py-8 text-center text-muted">No admin actions yet.</div>}
        </div>
      </div>
    </div>
  );
}
