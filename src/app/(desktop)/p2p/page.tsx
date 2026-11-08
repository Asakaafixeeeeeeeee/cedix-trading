'use client';
import Link from 'next/link';
import { useState } from 'react';
import { post, usePoll, useUser } from '@/lib/hooks';
import { fmtGHS, fmtNum, timeAgo } from '@/lib/format';

type Offer = {
  id: string;
  side: 'BUY' | 'SELL';
  asset: string;
  priceGHS: string;
  minGHS: string;
  maxGHS: string;
  available: string;
  paymentMethods: string[];
  terms: string | null;
  user: { id: string; username: string; displayName: string | null; kycLevel: number; createdAt: string };
};

type P2POrder = {
  id: string;
  asset: string;
  amount: string;
  priceGHS: string;
  totalGHS: string;
  status: string;
  buyerId: string;
  sellerId: string;
  createdAt: string;
  buyer: { username: string };
  seller: { username: string };
};

const ASSETS = ['USDT', 'BTC', 'ETH', 'SOL'];
const PAYMENT_OPTIONS = ['MTN MoMo', 'Telecel Cash', 'AT Money', 'Bank Transfer'];

export default function P2PPage() {
  const { user } = useUser();
  // "buy" tab = I want to buy crypto = show maker SELL offers
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [asset, setAsset] = useState('USDT');
  const side = tab === 'buy' ? 'SELL' : 'BUY';
  const { data, refresh } = usePoll<{ offers: Offer[]; myId: string | null }>(`/api/p2p/offers?side=${side}&asset=${asset}`, 10000);
  const { data: myOrders, refresh: refreshOrders } = usePoll<{ orders: P2POrder[]; myId: string }>(user ? '/api/p2p/orders' : null, 8000);
  const [taking, setTaking] = useState<Offer | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">P2P Trading</h1>
          <p className="mt-1 text-sm text-muted">Buy and sell crypto with GH₵ directly with other Ghanaians. Escrow protected.</p>
        </div>
        {user && (
          <button onClick={() => setCreating(true)} className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-gray-200">
            + Post an Offer
          </button>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border border-line">
          <button onClick={() => setTab('buy')} className={`px-6 py-2 text-sm font-semibold ${tab === 'buy' ? 'bg-up text-white' : 'text-muted'}`}>
            Buy Crypto
          </button>
          <button onClick={() => setTab('sell')} className={`px-6 py-2 text-sm font-semibold ${tab === 'sell' ? 'bg-down text-white' : 'text-muted'}`}>
            Sell Crypto
          </button>
        </div>
        <div className="flex gap-1.5">
          {ASSETS.map((a) => (
            <button
              key={a}
              onClick={() => setAsset(a)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${asset === a ? 'bg-panel2 text-white' : 'text-muted hover:text-white'}`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2.5 pl-4 font-medium">Advertiser</th>
              <th className="font-medium">Price</th>
              <th className="hidden font-medium md:table-cell">Available / Limits</th>
              <th className="hidden font-medium lg:table-cell">Payment</th>
              <th className="pr-4 text-right font-medium">Trade</th>
            </tr>
          </thead>
          <tbody>
            {(data?.offers ?? []).length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-muted">No offers for {asset} right now.</td></tr>
            )}
            {(data?.offers ?? []).map((o) => (
              <tr key={o.id} className="border-t border-line/60">
                <td className="py-3 pl-4">
                  <div className="font-semibold">{o.user.displayName || o.user.username}</div>
                  <div className="text-xs text-muted">
                    @{o.user.username} · KYC L{o.user.kycLevel} · joined {timeAgo(o.user.createdAt)}
                  </div>
                </td>
                <td className="num font-bold">{fmtGHS(Number(o.priceGHS))}<span className="text-xs font-normal text-muted">/{o.asset}</span></td>
                <td className="num hidden text-xs text-muted md:table-cell">
                  {fmtNum(Number(o.available))} {o.asset}
                  <br />
                  {fmtGHS(Number(o.minGHS))} – {fmtGHS(Number(o.maxGHS))}
                </td>
                <td className="hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {o.paymentMethods.map((p) => (
                      <span key={p} className="rounded bg-panel2 px-2 py-0.5 text-[10px] text-muted">{p}</span>
                    ))}
                  </div>
                </td>
                <td className="pr-4 text-right">
                  {data?.myId === o.user.id ? (
                    <span className="text-xs text-muted">Your offer</span>
                  ) : (
                    <button
                      onClick={() => (user ? setTaking(o) : (window.location.href = '/login'))}
                      className={`rounded-md px-4 py-1.5 text-xs font-semibold text-white ${tab === 'buy' ? 'bg-up' : 'bg-down'} hover:brightness-110`}
                    >
                      {tab === 'buy' ? `Buy ${o.asset}` : `Sell ${o.asset}`}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {user && (myOrders?.orders ?? []).length > 0 && (
        <div className="mt-6 rounded-xl border border-line bg-panel">
          <div className="border-b border-line px-4 py-3 font-semibold">My P2P Orders</div>
          {(myOrders?.orders ?? []).map((o) => (
            <OrderRow key={o.id} order={o} myId={myOrders!.myId} onAction={() => { refreshOrders(); refresh(); }} />
          ))}
        </div>
      )}

      {taking && (
        <TakeOfferModal offer={taking} buying={tab === 'buy'} onClose={() => setTaking(null)} onDone={() => { setTaking(null); refresh(); refreshOrders(); }} />
      )}
      {creating && <CreateOfferModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); refresh(); }} />}
      {!user && (
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/login" className="text-accent hover:underline">Log in</Link> to trade P2P.
        </p>
      )}
    </div>
  );
}

function OrderRow({ order, myId, onAction }: { order: P2POrder; myId: string; onAction: () => void }) {
  const [busy, setBusy] = useState(false);
  const isBuyer = order.buyerId === myId;

  async function act(action: string) {
    setBusy(true);
    try {
      await post(`/api/p2p/orders/${order.id}`, { action });
      onAction();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const statusColor: Record<string, string> = {
    PENDING_PAYMENT: 'text-gold',
    PAID: 'text-accent',
    RELEASED: 'text-up',
    CANCELLED: 'text-muted',
    DISPUTED: 'text-down',
  };

  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-line/60 px-4 py-3 text-sm">
      <div>
        <span className={`font-semibold ${isBuyer ? 'text-up' : 'text-down'}`}>{isBuyer ? 'BUY' : 'SELL'}</span>{' '}
        <span className="num">{fmtNum(Number(order.amount))} {order.asset}</span>
        <span className="num text-muted"> for {fmtGHS(Number(order.totalGHS))}</span>
        <div className="text-xs text-muted">
          with @{isBuyer ? order.seller.username : order.buyer.username} · {timeAgo(order.createdAt)}
        </div>
      </div>
      <span className={`text-xs font-bold ${statusColor[order.status]}`}>{order.status.replace('_', ' ')}</span>
      <div className="ml-auto flex gap-2">
        {order.status === 'PENDING_PAYMENT' && isBuyer && (
          <button disabled={busy} onClick={() => act('paid')} className="rounded bg-up px-3 py-1.5 text-xs font-semibold text-white">
            I&apos;ve Paid
          </button>
        )}
        {order.status === 'PAID' && !isBuyer && (
          <button disabled={busy} onClick={() => act('release')} className="rounded bg-up px-3 py-1.5 text-xs font-semibold text-white">
            Release Crypto
          </button>
        )}
        {order.status === 'PENDING_PAYMENT' && (
          <button disabled={busy} onClick={() => act('cancel')} className="rounded border border-line px-3 py-1.5 text-xs text-muted hover:text-white">
            Cancel
          </button>
        )}
        {(order.status === 'PAID' || order.status === 'PENDING_PAYMENT') && (
          <button disabled={busy} onClick={() => act('dispute')} className="rounded border border-down/50 px-3 py-1.5 text-xs text-down">
            Dispute
          </button>
        )}
      </div>
    </div>
  );
}

function TakeOfferModal({ offer, buying, onClose, onDone }: { offer: Offer; buying: boolean; onClose: () => void; onDone: () => void }) {
  const [ghs, setGhs] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const amt = parseFloat(ghs) || 0;
  const crypto = amt / Number(offer.priceGHS);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await post('/api/p2p/orders', { offerId: offer.id, amountGHS: amt });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title={`${buying ? 'Buy' : 'Sell'} ${offer.asset} ${buying ? 'from' : 'to'} @${offer.user.username}`}>
      <div className="num rounded-lg border border-line bg-bg p-3 text-sm">
        <div className="flex justify-between"><span className="text-muted">Price</span><span>{fmtGHS(Number(offer.priceGHS))}/{offer.asset}</span></div>
        <div className="flex justify-between"><span className="text-muted">Limits</span><span>{fmtGHS(Number(offer.minGHS))} – {fmtGHS(Number(offer.maxGHS))}</span></div>
      </div>
      {offer.terms && <p className="mt-3 rounded-lg bg-panel2 p-3 text-xs text-muted">{offer.terms}</p>}
      <label className="mt-4 block">
        <span className="text-sm text-muted">Amount (GH₵)</span>
        <input
          type="number"
          value={ghs}
          onChange={(e) => setGhs(e.target.value)}
          className="num mt-1 w-full rounded-lg border border-line bg-bg px-4 py-3 outline-none focus:border-accent"
          placeholder="0.00"
        />
      </label>
      {amt > 0 && (
        <p className="num mt-2 text-sm text-muted">
          {buying ? 'You receive' : 'You send'}: <b className="text-white">{crypto.toFixed(8)} {offer.asset}</b>
        </p>
      )}
      {error && <p className="mt-2 text-sm text-down">{error}</p>}
      <button
        onClick={submit}
        disabled={busy || !(amt > 0)}
        className={`mt-4 w-full rounded-lg py-3 font-semibold text-white disabled:opacity-40 ${buying ? 'bg-up' : 'bg-down'}`}
      >
        {busy ? 'Placing…' : buying ? 'Buy Now' : 'Sell Now'}
      </button>
      <p className="mt-2 text-center text-[11px] text-muted">Crypto is held in escrow until payment is confirmed.</p>
    </Modal>
  );
}

function CreateOfferModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ side: 'SELL', asset: 'USDT', priceGHS: '', minGHS: '50', maxGHS: '10000', available: '', terms: '' });
  const [methods, setMethods] = useState<string[]>(['MTN MoMo']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await post('/api/p2p/offers', { ...form, paymentMethods: methods });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setBusy(false);
    }
  }

  const input = 'mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent';

  return (
    <Modal onClose={onClose} title="Post a P2P Offer">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => set('side', 'SELL')} className={`rounded-lg border py-2.5 text-sm font-semibold ${form.side === 'SELL' ? 'border-down bg-down/10 text-down' : 'border-line text-muted'}`}>
          I&apos;m Selling Crypto
        </button>
        <button onClick={() => set('side', 'BUY')} className={`rounded-lg border py-2.5 text-sm font-semibold ${form.side === 'BUY' ? 'border-up bg-up/10 text-up' : 'border-line text-muted'}`}>
          I&apos;m Buying Crypto
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-sm text-muted">
          Asset
          <select value={form.asset} onChange={(e) => set('asset', e.target.value)} className={input}>
            {ASSETS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label className="text-sm text-muted">
          Price (GH₵ per unit)
          <input type="number" value={form.priceGHS} onChange={(e) => set('priceGHS', e.target.value)} className={input} />
        </label>
        <label className="text-sm text-muted">
          Min order (GH₵)
          <input type="number" value={form.minGHS} onChange={(e) => set('minGHS', e.target.value)} className={input} />
        </label>
        <label className="text-sm text-muted">
          Max order (GH₵)
          <input type="number" value={form.maxGHS} onChange={(e) => set('maxGHS', e.target.value)} className={input} />
        </label>
      </div>
      <label className="mt-3 block text-sm text-muted">
        Total available ({form.asset})
        <input type="number" value={form.available} onChange={(e) => set('available', e.target.value)} className={input} />
      </label>
      <div className="mt-3 text-sm text-muted">
        Payment methods
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {PAYMENT_OPTIONS.map((p) => (
            <button
              key={p}
              onClick={() => setMethods((m) => (m.includes(p) ? m.filter((x) => x !== p) : [...m, p]))}
              className={`rounded-md border px-2.5 py-1 text-xs ${methods.includes(p) ? 'border-accent bg-accent/10 text-white' : 'border-line text-muted'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <label className="mt-3 block text-sm text-muted">
        Terms (optional)
        <textarea value={form.terms} onChange={(e) => set('terms', e.target.value)} rows={2} className={input} />
      </label>
      {error && <p className="mt-2 text-sm text-down">{error}</p>}
      <button onClick={submit} disabled={busy} className="mt-4 w-full rounded-lg bg-white py-3 font-semibold text-black disabled:opacity-40">
        {busy ? 'Posting…' : 'Post Offer'}
      </button>
      {form.side === 'SELL' && (
        <p className="mt-2 text-center text-[11px] text-muted">Crypto for SELL offers is escrowed from your balance when an order is taken.</p>
      )}
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-panel p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-white">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
