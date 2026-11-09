'use client';
import Link from 'next/link';
import { usePoll } from '@/lib/hooks';
import { fmtNum } from '@/lib/format';

type Order = {
  id: string;
  orderNo: string;
  status: string;
  asset: string;
  amount: string;
  totalGHS: string;
  createdAt: string;
  buyerId: string;
  buyer: { username: string };
  seller: { username: string };
};

const BADGE: Record<string, string> = {
  PENDING_PAYMENT: 'bg-amber-500/15 text-amber-400',
  PAID: 'bg-blue-500/15 text-blue-400',
  RELEASED: 'bg-emerald-500/15 text-emerald-400',
  CANCELLED: 'bg-panel text-muted',
  EXPIRED: 'bg-panel text-muted',
  DISPUTED: 'bg-red-500/15 text-red-400',
};

export default function P2POrdersPage() {
  const { data } = usePoll<{ orders: Order[]; myId: string }>(`/api/p2p/orders`, 8000);

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center gap-3">
        <Link href="/m/p2p" aria-label="Back" className="text-muted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </Link>
        <h1 className="text-[17px] font-bold">P2P Orders</h1>
      </div>

      <div className="mt-3 divide-y divide-line">
        {!data && <p className="py-12 text-center text-xs text-muted">Loading…</p>}
        {data?.orders.length === 0 && <p className="py-12 text-center text-xs text-muted">No P2P orders yet.</p>}
        {data?.orders.map((o) => {
          const iAmBuyer = o.buyerId === data.myId;
          return (
            <Link key={o.id} href={`/m/p2p/order/${o.id}`} className="block py-3.5">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-bold">
                  {iAmBuyer ? 'Buy' : 'Sell'} {o.asset}
                  <span className="ml-2 text-[11px] font-normal text-muted">{iAmBuyer ? o.seller.username : o.buyer.username}</span>
                </p>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${BADGE[o.status] ?? 'bg-panel text-muted'}`}>
                  {o.status.replace('_', ' ')}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
                <span>{fmtNum(Number(o.amount))} {o.asset} · GH¢{fmtNum(Number(o.totalGHS))}</span>
                <span>{new Date(o.createdAt).toLocaleString()}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
