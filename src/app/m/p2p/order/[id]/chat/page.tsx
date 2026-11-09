'use client';
import Link from 'next/link';
import { use, useEffect, useRef, useState } from 'react';
import { usePoll } from '@/lib/hooks';
import { fmtNum } from '@/lib/format';

type ChatMsg = {
  id: string;
  role: 'ASSISTANT' | 'BUYER' | 'SELLER' | 'SYSTEM';
  body: string;
  meta: { kind?: string; options?: string[]; checkoutUrl?: string; automated?: boolean } | null;
  createdAt: string;
};

type OrderResponse = {
  order: {
    id: string;
    orderNo: string;
    status: string;
    asset: string;
    amount: string;
    totalGHS: string;
    paymentMethod: string | null;
    expiresAt: string | null;
    buyerId: string;
    sellerId: string;
    buyer: { username: string; displayName: string | null };
    seller: { username: string; displayName: string | null };
  };
  chat: ChatMsg[];
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
  const skew = serverNow ? Date.now() - serverNow : 0;
  const ms = new Date(expiresAt).getTime() - (Date.now() - skew);
  if (ms <= 0) return '00:00';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function P2POrderChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, refresh } = usePoll<OrderResponse>(`/api/p2p/orders/${id}`, 3500);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);
  const countdown = useCountdown(data?.order.expiresAt ?? null, data?.serverNow);

  useEffect(() => {
    const count = data?.chat.length ?? 0;
    if (count !== lastCount.current) {
      lastCount.current = count;
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [data?.chat.length]);

  async function act(payload: object) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/p2p/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Request failed');
      await refresh();
      return d;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  async function chooseNetwork(network: string) {
    const d = await act({ type: 'choose-network', network });
    if (d?.checkoutUrl) window.open(d.checkoutUrl, '_blank', 'noopener');
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    await act({ type: 'message', body: text });
  }

  if (!data) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-white" />
      </div>
    );
  }

  const { order, chat, myId } = data;
  const iAmBuyer = order.buyerId === myId;
  const other = iAmBuyer ? order.seller : order.buyer;
  const otherName = (other.displayName || other.username).toUpperCase();
  const pending = order.status === 'PENDING_PAYMENT';
  // Show the network buttons under the LATEST choose-network prompt only
  const lastChooser = [...chat].reverse().find((m) => m.meta?.kind === 'choose-network');

  return (
    <div className="flex min-h-dvh flex-col pb-0">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-line bg-[#0a0c0f]/95 px-4 pb-3 pt-[calc(10px+env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-3">
          <Link href={`/m/p2p/order/${order.id}`} aria-label="Back" className="text-muted">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
          </Link>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-panel text-[13px] font-bold">{otherName.slice(0, 1)}</span>
          <div>
            <p className="text-[14px] font-bold leading-tight">{otherName}</p>
            <p className="text-[10px] text-muted">Order {order.orderNo}</p>
          </div>
          {pending && countdown && (
            <span className="ml-auto rounded-full bg-panel px-3 py-1 text-[11px] font-bold text-gold">{countdown}</span>
          )}
        </div>
      </header>

      <main className="flex-1 space-y-3 px-4 pb-40 pt-3">
        <p className="px-6 text-center text-[10px] leading-relaxed text-muted">
          This chat is private and secure. For your security, pay only through the official CediX checkout — never send money directly or release crypto for screenshots.
        </p>

        {chat.map((m) => {
          const mineRole = iAmBuyer ? 'BUYER' : 'SELLER';
          const mine = m.role === mineRole;
          const isAssistant = m.role === 'ASSISTANT';
          const isSystem = m.role === 'SYSTEM';
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${mine ? 'bg-emerald-600 text-white' : 'bg-panel'}`}>
                {isAssistant && <p className="mb-0.5 text-[10px] font-bold text-accent">CediX Automated Payment Assistant</p>}
                {isSystem && <p className="mb-0.5 text-[10px] font-bold text-muted">System</p>}
                <p className="whitespace-pre-line text-[13px] leading-snug">{m.body}</p>
                {m.meta?.automated && <p className="mt-1 border-t border-line pt-1 text-[10px] text-muted">This is an automated message</p>}

                {/* Network choice buttons (buyer, latest prompt, order still payable) */}
                {m.meta?.kind === 'choose-network' && m.id === lastChooser?.id && pending && iAmBuyer && (
                  <div className="mt-2 space-y-1.5">
                    {(m.meta.options ?? []).map((opt) => (
                      <button
                        key={opt}
                        disabled={busy}
                        onClick={() => chooseNetwork(opt)}
                        className="block w-full rounded-full bg-white py-2 text-[12px] font-bold text-black disabled:opacity-50"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Official checkout button */}
                {m.meta?.kind === 'checkout' && m.meta.checkoutUrl && pending && iAmBuyer && (
                  <a
                    href={m.meta.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block rounded-full bg-black py-2.5 text-center text-[12px] font-bold text-white"
                  >
                    Pay now — GH¢{fmtNum(Number(order.totalGHS))}
                  </a>
                )}
              </div>
            </div>
          );
        })}

        {order.status === 'RELEASED' && (
          <div className="rounded-2xl bg-emerald-500/10 p-4 text-center">
            <p className="text-[13px] font-bold text-emerald-400">Order completed</p>
            <p className="mt-1 text-[11px] text-muted">{fmtNum(Number(order.amount))} {order.asset} is in your wallet.</p>
            <Link href="/m/assets" className="mt-2 inline-block rounded-full bg-white px-6 py-2 text-[12px] font-bold text-black">View assets</Link>
          </div>
        )}
        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
        <div ref={bottomRef} />
      </main>

      {/* Composer + verify */}
      <footer className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-lg border-t border-line bg-[#0a0c0f]/95 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        {pending && iAmBuyer && order.paymentMethod && (
          <button
            disabled={busy}
            onClick={() => act({ type: 'verify' })}
            className="mb-2 w-full rounded-full bg-panel py-2 text-[11px] font-bold text-muted disabled:opacity-50"
          >
            {busy ? 'Checking with provider…' : "I've completed payment — check status"}
          </button>
        )}
        <form onSubmit={send} className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message"
            className="flex-1 rounded-full border border-line bg-panel px-4 py-2.5 text-[13px] placeholder:text-muted"
          />
          <button type="submit" disabled={!draft.trim() || busy} className="rounded-full bg-white px-4 py-2.5 text-[13px] font-bold text-black disabled:opacity-40">
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}
