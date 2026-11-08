'use client';
import { useState } from 'react';
import { post, usePoll, useUser } from '@/lib/hooks';
import { fmtNum, timeAgo } from '@/lib/format';

type Order = {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  price: string | null;
  quantity: string;
  filledQty: string;
  avgFillPrice: string | null;
  status: string;
  createdAt: string;
};

export default function OpenOrders({ refreshKey }: { refreshKey: number }) {
  const { user } = useUser();
  const [tab, setTab] = useState<'open' | 'history'>('open');
  const { data, refresh } = usePoll<{ orders: Order[] }>(
    user ? `/api/orders${tab === 'open' ? '?status=open&' : '?'}k=${refreshKey}` : null,
    5000,
  );

  async function cancel(id: string) {
    try {
      await post(`/api/orders/${id}`, undefined, 'DELETE');
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Cancel failed');
    }
  }

  const orders = (data?.orders ?? []).filter((o) => (tab === 'open' ? o.status === 'OPEN' : true));

  return (
    <div className="rounded-xl border border-line bg-panel">
      <div className="flex gap-1 border-b border-line px-3 py-2">
        {(
          [
            ['open', 'Open Orders'],
            ['history', 'Order History'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-panel2 text-white' : 'text-muted hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-2 pl-4 font-medium">Time</th>
              <th className="font-medium">Pair</th>
              <th className="font-medium">Side</th>
              <th className="font-medium">Type</th>
              <th className="font-medium">Price</th>
              <th className="font-medium">Amount</th>
              <th className="font-medium">Filled</th>
              <th className="font-medium">Status</th>
              <th className="pr-4 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {!user && (
              <tr><td colSpan={9} className="py-8 text-center text-muted">Log in to see your orders.</td></tr>
            )}
            {user && orders.length === 0 && (
              <tr><td colSpan={9} className="py-8 text-center text-muted">No {tab === 'open' ? 'open orders' : 'orders yet'}.</td></tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="num border-t border-line/60">
                <td className="py-2.5 pl-4 text-muted">{timeAgo(o.createdAt)}</td>
                <td className="font-medium">{o.symbol}</td>
                <td className={o.side === 'BUY' ? 'text-up' : 'text-down'}>{o.side}</td>
                <td>{o.type}</td>
                <td>{o.avgFillPrice ? fmtNum(Number(o.avgFillPrice), 4) : o.price ? fmtNum(Number(o.price), 4) : 'Market'}</td>
                <td>{fmtNum(Number(o.quantity))}</td>
                <td>{fmtNum(Number(o.filledQty))}</td>
                <td>
                  <span
                    className={
                      o.status === 'FILLED' ? 'text-up' : o.status === 'CANCELLED' ? 'text-muted' : 'text-gold'
                    }
                  >
                    {o.status}
                  </span>
                </td>
                <td className="pr-4 text-right">
                  {o.status === 'OPEN' && (
                    <button onClick={() => cancel(o.id)} className="rounded border border-line px-2 py-1 text-muted hover:border-down hover:text-down">
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
