'use client';
import { useState } from 'react';
import { post, usePoll } from '@/lib/hooks';
import { fmtGHS, fmtNum, timeAgo } from '@/lib/format';

type Offer = {
  id: string; side: string; asset: string; priceGHS: string; available: string; active: boolean;
  createdAt: string; user: { username: string; email: string }; _count: { orders: number };
};
type Order = {
  id: string; status: string; asset: string; amount: string; totalGHS: string; createdAt: string;
  buyer: { username: string }; seller: { username: string };
};
type Settings = { enabled: boolean; expressEnabled: boolean; assistantEnabled: boolean; expiryMinutes: number; feePct: number };
type Limits = { minDepositUSD: number; minWithdrawalUSD: number };

export default function AdminP2P() {
  const { data, refresh } = usePoll<{ offers: Offer[]; orders: Order[]; disputes: Order[]; settings?: Settings; limits?: Limits }>('/api/admin/p2p', 15000);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  async function act(kind: string, id: string, action: string) {
    if (kind === 'dispute' && !confirm(`Resolve dispute: ${action}?`)) return;
    setBusy(id);
    try {
      await post('/api/admin/p2p', { kind, id, action }, 'PATCH');
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  async function saveSettings(patch: Record<string, boolean | number>) {
    setBusy('settings');
    try {
      await post('/api/admin/p2p', { kind: 'settings', action: patch }, 'PATCH');
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  const disputes = data?.disputes ?? [];
  const s = data?.settings;
  const lim = data?.limits;

  return (
    <div className="space-y-6">
      {/* Global P2P + limits controls */}
      <section>
        <h3 className="mb-2 font-bold">Controls</h3>
        <div className="grid gap-3 rounded-xl border border-line bg-panel p-4 sm:grid-cols-2 lg:grid-cols-3">
          {s && (
            <>
              {([
                ['P2P trading', 'enabled', s.enabled],
                ['Express trading', 'expressEnabled', s.expressEnabled],
                ['Payment assistant', 'assistantEnabled', s.assistantEnabled],
              ] as const).map(([label, key, value]) => (
                <label key={key} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 text-sm">
                  <span>{label}</span>
                  <button
                    disabled={busy === 'settings'}
                    onClick={() => saveSettings({ [key]: !value })}
                    className={`h-6 w-11 rounded-full p-0.5 transition-colors ${value ? 'bg-up' : 'bg-line'}`}
                  >
                    <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : ''}`} />
                  </button>
                </label>
              ))}
              {([
                ['Order expiry (minutes)', 'expiryMinutes', s.expiryMinutes],
                ['P2P fee (%)', 'feePct', s.feePct],
              ] as const).map(([label, key, value]) => (
                <NumberSetting key={key} label={label} value={value} draft={draft[key]} setDraft={(v) => setDraft((d) => ({ ...d, [key]: v }))} onSave={(n) => saveSettings({ [key]: n })} busy={busy === 'settings'} />
              ))}
            </>
          )}
          {lim && ([
            ['Min deposit (USD)', 'minDepositUSD', lim.minDepositUSD],
            ['Min withdrawal (USD)', 'minWithdrawalUSD', lim.minWithdrawalUSD],
          ] as const).map(([label, key, value]) => (
            <NumberSetting key={key} label={label} value={value} draft={draft[key]} setDraft={(v) => setDraft((d) => ({ ...d, [key]: v }))} onSave={(n) => saveSettings({ [key]: n })} busy={busy === 'settings'} />
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-2 font-bold">Disputes {disputes.length > 0 && <span className="text-down">({disputes.length})</span>}</h3>
        {disputes.length === 0 ? (
          <div className="rounded-xl border border-line bg-panel py-8 text-center text-sm text-muted">No open disputes.</div>
        ) : (
          disputes.map((o) => (
            <div key={o.id} className="mb-2 flex flex-wrap items-center gap-3 rounded-xl border border-down/40 bg-panel px-4 py-3">
              <div className="min-w-0 flex-1 text-sm">
                <span className="num font-bold">{fmtNum(Number(o.amount))} {o.asset}</span>
                <span className="num text-muted"> for {fmtGHS(Number(o.totalGHS))}</span>
                <div className="text-xs text-muted">buyer @{o.buyer.username} · seller @{o.seller.username} · {timeAgo(o.createdAt)}</div>
              </div>
              <button disabled={busy === o.id} onClick={() => act('dispute', o.id, 'release')} className="rounded-lg bg-up px-3.5 py-1.5 text-xs font-bold text-[#ffffff] disabled:opacity-40">
                Release to buyer
              </button>
              <button disabled={busy === o.id} onClick={() => act('dispute', o.id, 'refund')} className="rounded-lg border border-line px-3.5 py-1.5 text-xs font-bold disabled:opacity-40">
                Refund seller
              </button>
            </div>
          ))
        )}
      </section>

      <section>
        <h3 className="mb-2 font-bold">Advertisements</h3>
        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2.5 pl-4 font-medium">Advertiser</th>
                <th className="font-medium">Side</th>
                <th className="font-medium">Asset</th>
                <th className="font-medium">Price</th>
                <th className="font-medium">Available</th>
                <th className="font-medium">Orders</th>
                <th className="font-medium">Status</th>
                <th className="pr-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {(data?.offers ?? []).map((o) => (
                <tr key={o.id} className="border-t border-line/60">
                  <td className="py-2.5 pl-4">
                    <div className="font-semibold">@{o.user.username}</div>
                    <div className="text-xs text-muted">{o.user.email}</div>
                  </td>
                  <td className={o.side === 'SELL' ? 'text-down' : 'text-up'}>{o.side}</td>
                  <td className="font-medium">{o.asset}</td>
                  <td className="num">{fmtGHS(Number(o.priceGHS))}</td>
                  <td className="num">{fmtNum(Number(o.available))}</td>
                  <td className="num">{o._count.orders}</td>
                  <td>{o.active ? <span className="text-up">Active</span> : <span className="text-muted">Suspended</span>}</td>
                  <td className="pr-4 text-right">
                    <button
                      disabled={busy === o.id}
                      onClick={() => act('offer', o.id, o.active ? 'suspend' : 'activate')}
                      className={`rounded-lg border px-3 py-1 text-xs font-medium disabled:opacity-40 ${o.active ? 'border-down/50 text-down' : 'border-up/50 text-up'}`}
                    >
                      {o.active ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-bold">Recent Orders</h3>
        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full min-w-[620px] text-sm">
            <tbody>
              {(data?.orders ?? []).slice(0, 30).map((o) => (
                <tr key={o.id} className="border-t border-line/60 first:border-0">
                  <td className="num py-2.5 pl-4">{fmtNum(Number(o.amount))} {o.asset}</td>
                  <td className="num text-muted">{fmtGHS(Number(o.totalGHS))}</td>
                  <td className="text-xs text-muted">@{o.buyer.username} ← @{o.seller.username}</td>
                  <td className="text-xs text-muted">{timeAgo(o.createdAt)}</td>
                  <td className={`pr-4 text-right text-xs font-bold ${o.status === 'RELEASED' ? 'text-up' : o.status === 'DISPUTED' ? 'text-down' : o.status === 'CANCELLED' ? 'text-muted' : 'text-gold'}`}>
                    {o.status.replace('_', ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function NumberSetting(props: {
  label: string;
  value: number;
  draft: string | undefined;
  setDraft: (v: string) => void;
  onSave: (n: number) => void;
  busy: boolean;
}) {
  const { label, value, draft, setDraft, onSave, busy } = props;
  const current = draft ?? String(value);
  const changed = parseFloat(current) !== value && parseFloat(current) >= 0;
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm">
      <span className="min-w-0 flex-1">{label}</span>
      <input
        value={current}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, ''))}
        className="num w-20 rounded-lg border border-line bg-panel2 px-2 py-1 text-right text-sm"
      />
      <button
        disabled={!changed || busy}
        onClick={() => onSave(parseFloat(current))}
        className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-black disabled:opacity-30"
      >
        Save
      </button>
    </label>
  );
}
