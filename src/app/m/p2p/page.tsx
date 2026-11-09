'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { post, useUser } from '@/lib/hooks';
import { fmtNum } from '@/lib/format';

type Offer = {
  id: string;
  side: 'BUY' | 'SELL';
  asset: string;
  priceGHS: string;
  minGHS: string;
  maxGHS: string;
  available: string;
  paymentMethods: string[];
  user: { id: string; username: string; displayName: string | null; kycLevel: number };
  stats: { trades: number; completionPct: number | null };
};

type OffersResponse = {
  offers: Offer[];
  myId: string | null;
  settings: { enabled: boolean; expressEnabled: boolean; expiryMinutes: number };
};

const ASSETS = ['USDT', 'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE'];
const PAYMENTS = ['All payments', 'MTN Mobile Money', 'Telecel Cash', 'Bank Transfer'];

export default function P2PPage() {
  const router = useRouter();
  const { user } = useUser();
  const [tab, setTab] = useState<'p2p' | 'express'>('p2p');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY'); // user buys → maker SELL offers
  const [asset, setAsset] = useState('USDT');
  const [amount, setAmount] = useState('');
  const [payment, setPayment] = useState('All payments');
  const [data, setData] = useState<OffersResponse | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [takeOffer, setTakeOffer] = useState<Offer | null>(null);
  const [takeGHS, setTakeGHS] = useState('');

  const makerSide = side === 'BUY' ? 'SELL' : 'BUY';

  useEffect(() => {
    let stop = false;
    const params = new URLSearchParams({ side: makerSide, asset });
    if (parseFloat(amount) > 0) params.set('amount', amount);
    if (payment !== 'All payments') params.set('payment', payment);
    fetch(`/api/p2p/offers?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!stop) setData(d);
      })
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [makerSide, asset, amount, payment]);

  async function startOrder(offer: Offer, ghs: number) {
    if (!user) return router.push('/m/login');
    setBusy(offer.id);
    setError('');
    try {
      const res = await post<{ order: { id: string } }>('/api/p2p/orders', { offerId: offer.id, amountGHS: ghs });
      router.push(`/m/p2p/order/${res.order.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the order');
      setBusy('');
    }
  }

  const offers = data?.offers ?? [];

  return (
    <div className="px-4 pt-4">
      {/* Header: P2P | Express */}
      <div className="flex items-center gap-4">
        <Link href="/m/assets" aria-label="Back" className="text-muted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </Link>
        <button onClick={() => setTab('p2p')} className={`text-[17px] font-bold ${tab === 'p2p' ? 'border-b-2 border-accent pb-0.5' : 'text-muted'}`}>P2P</button>
        <button onClick={() => setTab('express')} className={`text-[17px] font-bold ${tab === 'express' ? 'border-b-2 border-accent pb-0.5' : 'text-muted'}`}>Express</button>
        <Link href="/m/p2p/orders" className="ml-auto text-xs font-semibold text-accent">Orders</Link>
      </div>

      {data && !data.settings.enabled && (
        <p className="mt-6 rounded-xl bg-panel px-4 py-3 text-center text-xs text-muted">P2P trading is temporarily unavailable.</p>
      )}

      {tab === 'express' ? (
        <Express
          enabled={data?.settings.expressEnabled ?? true}
          offers={offers}
          side={side}
          setSide={setSide}
          asset={asset}
          setAsset={setAsset}
          onConfirm={startOrder}
          busy={Boolean(busy)}
          error={error}
        />
      ) : (
        <>
          {/* Buy / Sell + currency */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-4">
              <button onClick={() => setSide('BUY')} className={`pb-1 text-[15px] font-bold ${side === 'BUY' ? 'border-b-2 border-accent' : 'text-muted'}`}>Buy</button>
              <button onClick={() => setSide('SELL')} className={`pb-1 text-[15px] font-bold ${side === 'SELL' ? 'border-b-2 border-accent' : 'text-muted'}`}>Sell</button>
            </div>
            <span className="text-[13px] font-semibold text-muted">GHS ▾</span>
          </div>

          {/* Filters */}
          <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            <select value={asset} onChange={(e) => setAsset(e.target.value)} className="shrink-0 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-semibold">
              {ASSETS.map((a) => <option key={a}>{a}</option>)}
            </select>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              inputMode="decimal"
              placeholder="Amount"
              className="w-24 shrink-0 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-semibold placeholder:text-muted"
            />
            <select value={payment} onChange={(e) => setPayment(e.target.value)} className="shrink-0 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-semibold">
              {PAYMENTS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>

          {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}

          {/* Merchant listings */}
          <div className="mt-2 divide-y divide-line">
            {offers.length === 0 && (
              <p className="py-12 text-center text-xs text-muted">No {side === 'BUY' ? 'sell' : 'buy'} ads for {asset} match your filters yet.</p>
            )}
            {offers.map((o) => {
              const name = (o.user.displayName || o.user.username).toUpperCase();
              const methods = Array.isArray(o.paymentMethods) ? o.paymentMethods : [];
              return (
                <div key={o.id} className="py-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-bold">{name}</span>
                    {o.user.kycLevel >= 2 && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="#d4b106"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.8 7.2 17l.9-5.4L4.2 7.7l5.4-.8z" /></svg>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted">
                    Trades {o.stats.trades}
                    {o.stats.completionPct !== null && ` (${o.stats.completionPct}%)`}
                  </p>
                  <p className="mt-1.5 text-[11px] text-muted">GH¢ <span className="text-[22px] font-extrabold text-white">{fmtNum(Number(o.priceGHS))}</span></p>
                  <div className="mt-1 flex items-end justify-between">
                    <div className="space-y-0.5 text-[11px] text-muted">
                      <p>Limit <span className="text-white/80">{fmtNum(Number(o.minGHS))}–{fmtNum(Number(o.maxGHS))} GHS</span></p>
                      <p>Available <span className="text-white/80">{fmtNum(Number(o.available))} {o.asset}</span></p>
                      <p className="text-[#c026d3]">{methods.join(' · ') || '—'}</p>
                    </div>
                    <button
                      disabled={busy === o.id || o.user.id === data?.myId}
                      onClick={() => { setTakeOffer(o); setTakeGHS(''); setError(''); }}
                      className={`rounded-full px-6 py-2 text-[13px] font-bold text-white disabled:opacity-40 ${side === 'BUY' ? 'bg-emerald-500' : 'bg-red-500'}`}
                    >
                      {busy === o.id ? '…' : side === 'BUY' ? 'Buy' : 'Sell'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Amount sheet for taking an offer */}
      {takeOffer && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setTakeOffer(null)}>
          <div className="w-full rounded-t-2xl bg-panel2 p-5 pb-[calc(20px+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold">{side === 'BUY' ? 'Buy' : 'Sell'} {takeOffer.asset} @ GH¢{fmtNum(Number(takeOffer.priceGHS))}</h3>
            <p className="mt-1 text-[11px] text-muted">Limit {fmtNum(Number(takeOffer.minGHS))}–{fmtNum(Number(takeOffer.maxGHS))} GHS</p>
            <input
              autoFocus
              value={takeGHS}
              onChange={(e) => setTakeGHS(e.target.value.replace(/[^\d.]/g, ''))}
              inputMode="decimal"
              placeholder="Amount in GHS"
              className="mt-3 w-full rounded-xl border border-line bg-panel px-4 py-3 text-[15px] font-semibold placeholder:text-muted"
            />
            {parseFloat(takeGHS) > 0 && (
              <p className="mt-2 text-xs text-muted">
                You {side === 'BUY' ? 'receive' : 'sell'} ≈ <span className="font-semibold text-white">{(parseFloat(takeGHS) / Number(takeOffer.priceGHS)).toFixed(6)} {takeOffer.asset}</span>
              </p>
            )}
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
            <button
              disabled={!(parseFloat(takeGHS) > 0) || Boolean(busy)}
              onClick={() => startOrder(takeOffer, parseFloat(takeGHS))}
              className={`mt-4 w-full rounded-xl py-3.5 text-[14px] font-bold text-white disabled:opacity-40 ${side === 'BUY' ? 'bg-emerald-500' : 'bg-red-500'}`}
            >
              {busy ? 'Creating order…' : `Place ${side === 'BUY' ? 'buy' : 'sell'} order`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Express ───────────────────────── */

function Express(props: {
  enabled: boolean;
  offers: Offer[];
  side: 'BUY' | 'SELL';
  setSide: (s: 'BUY' | 'SELL') => void;
  asset: string;
  setAsset: (a: string) => void;
  onConfirm: (offer: Offer, ghs: number) => void;
  busy: boolean;
  error: string;
}) {
  const { enabled, offers, side, setSide, asset, setAsset, onConfirm, busy, error } = props;
  const [pay, setPay] = useState('');
  const best = useMemo(() => offers[0] ?? null, [offers]);
  const ghs = parseFloat(pay) || 0;
  const receive = best && ghs > 0 ? ghs / Number(best.priceGHS) : 0;
  const withinLimit = best ? ghs >= Number(best.minGHS) && ghs <= Number(best.maxGHS) : false;

  if (!enabled) {
    return <p className="mt-8 rounded-xl bg-panel px-4 py-3 text-center text-xs text-muted">Express trading is temporarily unavailable.</p>;
  }

  return (
    <div className="mt-4">
      {/* Buy / Sell segmented */}
      <div className="flex rounded-full bg-panel p-1">
        {(['BUY', 'SELL'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`flex-1 rounded-full py-2 text-[13px] font-bold ${side === s ? 'bg-white text-black' : 'text-muted'}`}
          >
            {s === 'BUY' ? 'Buy' : 'Sell'}
          </button>
        ))}
      </div>

      <p className="mt-5 text-xs text-muted">You pay</p>
      <div className="mt-1 flex items-center justify-between">
        <input
          value={pay}
          onChange={(e) => setPay(e.target.value.replace(/[^\d.]/g, ''))}
          inputMode="decimal"
          placeholder="0"
          className="w-1/2 bg-transparent text-[34px] font-extrabold outline-none placeholder:text-muted"
        />
        <span className="rounded-full bg-panel px-4 py-2 text-[14px] font-bold">GHS</span>
      </div>
      {best && <p className="mt-0.5 text-[11px] text-muted">{fmtNum(Number(best.minGHS))} – {fmtNum(Number(best.maxGHS))}</p>}

      <p className="mt-5 text-xs text-muted">You receive</p>
      <div className="mt-1 flex items-center justify-between">
        <p className="w-1/2 truncate text-[34px] font-extrabold">{receive > 0 ? receive.toFixed(6) : '0'}</p>
        <select value={asset} onChange={(e) => setAsset(e.target.value)} className="rounded-full bg-panel px-4 py-2 text-[14px] font-bold">
          {ASSETS.map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>
      {best ? (
        <p className="mt-2 text-[11px] text-muted">1 {asset} ≈ {fmtNum(Number(best.priceGHS))} GHS · merchant {(best.user.displayName || best.user.username).toUpperCase()}</p>
      ) : (
        <p className="mt-2 text-[11px] text-muted">No live {side === 'BUY' ? 'sell' : 'buy'} ads for {asset} right now.</p>
      )}

      {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}

      <button
        disabled={!best || !withinLimit || busy}
        onClick={() => best && onConfirm(best, ghs)}
        className="mt-6 w-full rounded-xl bg-emerald-500 py-3.5 text-[14px] font-bold text-white disabled:opacity-40"
      >
        {busy ? 'Creating order…' : !best ? 'No ads available' : !withinLimit && ghs > 0 ? `Enter ${fmtNum(Number(best.minGHS))}–${fmtNum(Number(best.maxGHS))} GHS` : side === 'BUY' ? `Buy ${asset}` : `Sell ${asset}`}
      </button>
      <p className="mt-3 text-center text-[10px] leading-relaxed text-muted">
        Express matches you with the best-priced live ad. Payment goes through the official CediX checkout and your crypto is released after the provider confirms payment.
      </p>
    </div>
  );
}
