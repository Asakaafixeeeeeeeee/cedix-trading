'use client';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { usePoll } from '@/lib/hooks';
import { fmtNum } from '@/lib/format';

type OrderResponse = {
  order: {
    id: string;
    orderNo: string;
    status: string;
    asset: string;
    amount: string;
    priceGHS: string;
    totalGHS: string;
    paymentMethod: string | null;
    expiresAt: string | null;
    buyerId: string;
    sellerId: string;
    buyer: { username: string; displayName: string | null };
    seller: { username: string; displayName: string | null };
  };
  chat: { id: string }[];
  myId: string;
  serverNow: number;
};

function useCountdown(expiresAt: string | null, serverNow?: number) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (!expiresAt) return null;
  // Correct for client clock skew using the server timestamp
  const skew = serverNow ? Date.now() - serverNow : 0;
  const ms = new Date(expiresAt).getTime() - (Date.now() - skew);
  if (ms <= 0) return '00:00';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Awaiting your payment',
  PAID: 'Payment received — releasing',
  RELEASED: 'Completed',
  CANCELLED: 'Cancelled',
  DISPUTED: 'Under review',
  EXPIRED: 'Expired',
};

export default function P2POrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data } = usePoll<OrderResponse>(`/api/p2p/orders/${id}`, 4000);
  const countdown = useCountdown(data?.order.expiresAt ?? null, data?.serverNow);

  if (!data) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-white" />
      </div>
    );
  }

  const { order, myId } = data;
  const iAmBuyer = order.buyerId === myId;
  const other = iAmBuyer ? order.seller : order.buyer;
  const otherName = (other.displayName || other.username).toUpperCase();
  const pending = order.status === 'PENDING_PAYMENT';

  return (
    <div className="px-4 pt-4 pb-28">
      {/* Top banner */}
      <div className={`rounded-2xl p-4 ${pending ? 'bg-panel' : order.status === 'RELEASED' ? 'bg-emerald-500/10' : 'bg-panel'}`}>
        <div className="flex items-center justify-between">
          <h1 className="text-[15px] font-bold">
            {pending ? 'Complete payment for P2P order' : STATUS_LABEL[order.status] ?? order.status}
          </h1>
          <Link href="/m/p2p" className="text-xs text-accent">Market</Link>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {pending
            ? `P2P order ${order.orderNo} is awaiting your payment. Please complete payment before the order expires.`
            : order.status === 'RELEASED'
              ? `${fmtNum(Number(order.amount))} ${order.asset} has been released to your wallet.`
              : order.status === 'EXPIRED'
                ? 'This order expired before payment was completed.'
                : `Order ${order.orderNo}.`}
        </p>
        {pending && countdown && (
          <p className="mt-2 text-[13px] font-bold tracking-wide text-gold">PAYMENT TIME REMAINING: {countdown}</p>
        )}
      </div>

      {/* Merchant card */}
      <div className="mt-3 rounded-2xl bg-panel p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-panel2 text-[15px] font-bold">
            {otherName.slice(0, 1)}
          </span>
          <div>
            <p className="text-[14px] font-bold">{otherName}</p>
            <p className="text-[11px] text-muted">{iAmBuyer ? 'Merchant' : 'Buyer'}</p>
          </div>
        </div>
        <Link
          href={`/m/p2p/order/${order.id}/chat`}
          className="mt-3 block rounded-full bg-white py-2.5 text-center text-[13px] font-bold text-black"
        >
          Chat
        </Link>
      </div>

      {/* Order details */}
      <h2 className="mt-5 text-[16px] font-bold">Order details</h2>
      <div className="mt-2 space-y-3 text-[13px]">
        <Row k="Order type" v={<span className="font-bold">{iAmBuyer ? 'Buy' : 'Sell'} {order.asset}</span>} />
        <Row k="Unit price" v={<b>GH¢{fmtNum(Number(order.priceGHS))}</b>} />
        <Row k="Quantity" v={<b>{fmtNum(Number(order.amount))} {order.asset}</b>} />
        <Row k="Order amount" v={<b>GH¢{fmtNum(Number(order.totalGHS))}</b>} />
        <Row k="Payment method" v={<b className="text-[#c026d3]">{order.paymentMethod ?? 'Not selected yet'}</b>} />
        <Row
          k="Order ID"
          v={
            <button className="flex items-center gap-1 font-semibold" onClick={() => navigator.clipboard?.writeText(order.orderNo)}>
              {order.orderNo}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
            </button>
          }
        />
        <Row k="Status" v={<b>{STATUS_LABEL[order.status] ?? order.status}</b>} />
      </div>

      {/* Bottom action */}
      {pending && iAmBuyer && (
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-lg px-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
          <Link
            href={`/m/p2p/order/${order.id}/chat`}
            className="block rounded-full bg-emerald-600 py-3.5 text-center text-[14px] font-bold text-white shadow-lg"
          >
            Get payment details
          </Link>
        </div>
      )}
      {order.status === 'RELEASED' && (
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-lg px-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
          <Link href="/m/assets" className="block rounded-full bg-white py-3.5 text-center text-[14px] font-bold text-black shadow-lg">
            View my assets
          </Link>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{k}</span>
      <span>{v}</span>
    </div>
  );
}
