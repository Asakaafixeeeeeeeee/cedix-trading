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

export default function AdminP2P() {
  const { data, refresh } = usePoll<{ offers: Offer[]; orders: Order[]; disputes: Order[] }>('/api/admin/p2p', 15000);
  const [busy, setBusy] = useState<string | null>(null);

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

  const disputes = data?.disputes ?? [];

  return (
    <div className="space-y-6">
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
          <table className="w-full text-sm">
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
          <table className="w-full text-sm">
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
