'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import TradeChart from '@/components/TradeChart';
import CoinIcon from '@/components/CoinIcon';
import { post, usePoll, useUser } from '@/lib/hooks';
import { useDisplayPrefs } from '@/lib/prefs';
import { fmtNum, fmtPct, fmtPrice, timeAgo } from '@/lib/format';
import type { MarketRow } from '@/components/MarketTable';
import type { Portfolio } from '@/lib/wallet';
import {
  IconChevronDown, IconSearch, IconClose, IconAlertCircle, IconCandles,
} from '@/components/icons';

const CATEGORIES = [
  { id: 'quick', label: 'Quick', enabled: false },
  { id: 'spot', label: 'Spot', enabled: true },
  { id: 'futures', label: 'Futures', enabled: false },
  { id: 'tradfi', label: 'TradFi', enabled: false },
  { id: 'options', label: 'Options', enabled: false },
  { id: 'bots', label: 'Bots', enabled: false },
];

type Depth = { bids: [number, number][]; asks: [number, number][] };
type Order = {
  id: string; symbol: string; side: 'BUY' | 'SELL'; type: string; price: string | null;
  quantity: string; filledQty: string; avgFillPrice: string | null; status: string; createdAt: string;
};

export default function MobileTradeView({ symbol }: { symbol: string }) {
  const router = useRouter();
  const { user } = useUser();
  const { money } = useDisplayPrefs();
  const { data: marketData } = usePoll<{ markets: MarketRow[] }>('/api/markets?type=spot', 5000);
  const { data: depth } = usePoll<Depth>(`/api/markets/depth?symbol=${symbol}&limit=50`, 2500);
  const { data: portfolio, refresh: refreshPortfolio } = usePoll<Portfolio>(user ? '/api/portfolio' : null, 10000);
  const { data: config } = usePoll<{ tradingFeePct: number }>('/api/config', 0);
  const { data: orderData, refresh: refreshOrders } = usePoll<{ orders: Order[] }>(user ? '/api/orders' : null, 6000);

  const market = useMemo(() => marketData?.markets.find((m) => m.symbol === symbol), [marketData, symbol]);
  const price = market?.price ?? null;
  const precision = market?.precision ?? 2;
  const base = market?.base ?? symbol.replace(/USDT$/, '');
  const quote = market?.quote ?? 'USDT';

  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [type, setType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [typeOpen, setTypeOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [limitPrice, setLimitPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [pct, setPct] = useState(0);
  const [pairOpen, setPairOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setAmount('');
    setPct(0);
    setLimitPrice('');
  }, [symbol, side]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 2200);
    return () => clearTimeout(t);
  }, [notice]);

  const baseBal = portfolio?.assets.find((a) => a.asset === base)?.available ?? 0;
  const quoteBal = portfolio?.assets.find((a) => a.asset === quote)?.available ?? 0;
  const effPrice = type === 'LIMIT' ? parseFloat(limitPrice) || price || 0 : price || 0;
  const feePct = config?.tradingFeePct ?? 0.1;
  const qtyPrecision = Math.max(2, 8 - precision);
  const maxBuy = effPrice > 0 ? (quoteBal / effPrice) * (1 - feePct / 100) : 0;
  const maxSell = baseBal;
  const amt = parseFloat(amount) || 0;
  const overMax = side === 'BUY' ? amt > maxBuy + 1e-12 : amt > maxSell + 1e-12;

  function applyPct(p: number) {
    setPct(p);
    const max = side === 'BUY' ? maxBuy : maxSell;
    setAmount(max > 0 ? ((max * p) / 100).toFixed(qtyPrecision) : '');
  }

  async function submitOrder() {
    try {
      await post('/api/orders', {
        symbol,
        side,
        type,
        price: type === 'LIMIT' ? parseFloat(limitPrice) : undefined,
        quantity: amt,
      });
      setConfirmOpen(false);
      setAmount('');
      setPct(0);
      setToast({ ok: true, text: type === 'MARKET' ? `${side === 'BUY' ? 'Bought' : 'Sold'} ${amt} ${base}` : 'Limit order placed' });
      refreshPortfolio();
      refreshOrders();
    } catch (e) {
      setConfirmOpen(false);
      setToast({ ok: false, text: e instanceof Error ? e.message : 'Order failed' });
    }
  }

  const up = (market?.changePct ?? 0) >= 0;

  return (
    <div className="pt-1">
      {/* Trading categories */}
      <div className="no-scrollbar flex items-center gap-5 overflow-x-auto px-4 py-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => { if (!c.enabled) setNotice(`${c.label} trading is coming soon`); }}
            className={`shrink-0 pb-1 text-[14px] ${
              c.id === 'spot'
                ? 'border-b-[3px] border-foreground font-bold text-foreground'
                : 'font-medium text-muted'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Pair selector row */}
      <div className="flex items-center justify-between px-4 py-1.5">
        <button onClick={() => setPairOpen(true)} className="flex items-center gap-2">
          <span className="text-[17px] font-bold">
            {base}<span className="text-muted">/{quote}</span>
          </span>
          <IconChevronDown size={16} className="text-muted" />
          <span className={`num text-[13px] font-semibold ${up ? 'text-up' : 'text-down'}`}>
            {market ? fmtPct(market.changePct) : ''}
          </span>
        </button>
        <Link href="/m/markets" className="rounded-full bg-panel p-2 text-foreground" aria-label="All markets">
          <IconCandles size={16} />
        </Link>
      </div>

      {/* Chart */}
      <div className="h-[330px] border-y border-line">
        <TradeChart symbol={symbol} precision={precision} />
      </div>

      {/* Trading panel: form + order book side by side */}
      <div className="grid grid-cols-[1fr_148px] gap-3 px-4 pt-3">
        {/* LEFT: trade form */}
        <div>
          {/* Buy / Sell toggle */}
          <div className="flex rounded-full bg-panel p-0.5">
            <button
              onClick={() => setSide('BUY')}
              className={`flex-1 rounded-full py-1.5 text-[13.5px] font-bold transition ${
                side === 'BUY' ? 'bg-up text-[#ffffff]' : 'text-muted'
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setSide('SELL')}
              className={`flex-1 rounded-full py-1.5 text-[13.5px] font-bold transition ${
                side === 'SELL' ? 'bg-down text-[#ffffff]' : 'text-muted'
              }`}
            >
              Sell
            </button>
          </div>

          {/* Order type */}
          <div className="relative mt-2.5">
            <button
              onClick={() => setTypeOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl bg-panel px-3 py-2.5 text-[13px] font-semibold"
            >
              <span className="flex items-center gap-1.5">
                {type === 'MARKET' ? 'Market order' : 'Limit order'}
                <span
                  onClick={(e) => { e.stopPropagation(); setInfoOpen(true); }}
                  className="text-muted"
                >
                  <IconAlertCircle size={14} />
                </span>
              </span>
              <IconChevronDown size={14} className="text-muted" />
            </button>
            {typeOpen && (
              <div className="absolute inset-x-0 top-12 z-30 overflow-hidden rounded-xl border border-line bg-bg shadow-xl">
                {(
                  [
                    ['MARKET', 'Market order', 'Execute now at the best price'],
                    ['LIMIT', 'Limit order', 'Execute at your price or better'],
                  ] as const
                ).map(([id, label, sub]) => (
                  <button
                    key={id}
                    onClick={() => { setType(id); setTypeOpen(false); }}
                    className={`block w-full px-3.5 py-3 text-left ${type === id ? 'bg-panel' : ''}`}
                  >
                    <span className="block text-[14px] font-semibold">{label}</span>
                    <span className="block text-[11px] text-muted">{sub}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Market price hint / Limit price input */}
          {type === 'MARKET' ? (
            <div className="num mt-2 rounded-xl bg-panel px-3 py-2.5 text-[12px] text-muted">
              Est. price <span className="float-right font-semibold text-foreground">{price ? fmtPrice(price, precision) : '—'}</span>
            </div>
          ) : (
            <div className="mt-2 flex items-center rounded-xl bg-panel px-3.5">
              <input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder={price ? fmtPrice(price, precision) : 'Price'}
                className="num w-full bg-transparent py-2.5 text-[13px] font-semibold outline-none placeholder:text-muted"
              />
              <span className="text-[12px] font-semibold text-muted">{quote}</span>
            </div>
          )}

          {/* Amount */}
          <div className="mt-2 flex items-center rounded-xl bg-panel px-3.5">
            <input
              type="number"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setPct(0); }}
              placeholder="Amount"
              className="num w-full bg-transparent py-2.5 text-[13px] font-semibold outline-none placeholder:text-muted"
            />
            <span className="text-[12px] font-semibold text-muted">{base}</span>
          </div>

          {/* Percentage slider */}
          <div className="mt-3 px-1">
            <input
              type="range"
              min={0}
              max={100}
              step={25}
              value={pct}
              onChange={(e) => applyPct(Number(e.target.value))}
              className="w-full accent-[#0b0e11] dark:accent-[#ffffff]"
            />
            <div className="flex justify-between text-[10px] text-muted">
              {[0, 25, 50, 75, 100].map((p) => (
                <button key={p} onClick={() => applyPct(p)} className={pct === p ? 'font-bold text-foreground' : ''}>
                  {p}%
                </button>
              ))}
            </div>
          </div>

          {/* Balance */}
          <div className="mt-2.5 space-y-1 text-[12px]">
            <div className="flex items-center justify-between text-muted">
              <span>Available</span>
              <span className="num flex items-center gap-1 text-foreground">
                {fmtNum(side === 'BUY' ? quoteBal : baseBal)} {side === 'BUY' ? quote : base}
                <Link href={side === 'BUY' ? '/m/transfer' : '/m/deposit'} aria-label="Add funds" className="flex h-4 w-4 items-center justify-center rounded-full border border-muted text-[10px] font-bold text-muted">+</Link>
              </span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Max {side === 'BUY' ? 'buy' : 'sell'}</span>
              <span className="num">{fmtNum(side === 'BUY' ? maxBuy : maxSell, qtyPrecision)} {base}</span>
            </div>
          </div>

          {/* TP/SL — honest: not yet supported by the order engine */}
          <label className="mt-2.5 flex items-center gap-2 text-[12px] text-muted">
            <input type="checkbox" disabled className="h-3.5 w-3.5 opacity-50" />
            TP/SL <span className="rounded bg-panel2 px-1 py-0.5 text-[9px] font-bold uppercase">Soon</span>
          </label>

          {/* Big confirm button */}
          {user ? (
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!(amt > 0) || overMax || !price || (type === 'LIMIT' && !(parseFloat(limitPrice) > 0))}
              className={`mt-3 w-full rounded-full py-3 text-[14px] font-bold text-[#ffffff] transition active:scale-[0.98] disabled:opacity-40 ${
                side === 'BUY' ? 'bg-up' : 'bg-down'
              }`}
            >
              {side === 'BUY' ? `Buy ${base}` : `Sell ${base}`}
            </button>
          ) : (
            <Link href="/m/login" className="mt-3 block w-full rounded-full bg-white py-3 text-center text-[14px] font-bold text-black">
              Log in to trade
            </Link>
          )}
          {overMax && <p className="mt-1.5 text-center text-[11px] font-medium text-down">Exceeds your available balance</p>}
        </div>

        {/* RIGHT: live order book */}
        <MobileOrderBook depth={depth} price={price} precision={precision} base={base} quote={quote} changePct={market?.changePct ?? 0} />
      </div>

      {/* Orders / Assets / Bots */}
      <OrdersSection
        symbol={symbol}
        orders={orderData?.orders ?? []}
        loggedIn={!!user}
        portfolio={portfolio}
        money={money}
        onChanged={() => { refreshOrders(); refreshPortfolio(); }}
      />

      {/* Sheets & toasts */}
      {pairOpen && (
        <PairSheet
          markets={(marketData?.markets ?? []).filter((m) => m.category === 'crypto' || m.category === 'new')}
          current={symbol}
          onSelect={(s) => { setPairOpen(false); router.replace(`/m/trade/${s}`); }}
          onClose={() => setPairOpen(false)}
        />
      )}
      {infoOpen && <OrderTypeInfo onClose={() => setInfoOpen(false)} />}
      {confirmOpen && (
        <ConfirmSheet
          side={side}
          type={type}
          base={base}
          quote={quote}
          amount={amt}
          price={type === 'LIMIT' ? parseFloat(limitPrice) : price ?? 0}
          feePct={feePct}
          precision={precision}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={submitOrder}
        />
      )}
      {toast && (
        <div className={`fixed inset-x-6 top-4 z-[80] rounded-2xl px-4 py-3 text-center text-[13px] font-bold text-[#ffffff] shadow-xl ${toast.ok ? 'bg-up' : 'bg-down'}`}>
          {toast.text}
        </div>
      )}
      {notice && (
        <div className="fixed inset-x-10 top-4 z-[80] rounded-full bg-black/80 px-4 py-2.5 text-center text-[12px] font-semibold text-[#ffffff] dark:bg-white/90 dark:text-[#0b0e11]">
          {notice}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Order book ───────────────────────── */

function groupLevels(levels: [number, number][], step: number, dir: 'bid' | 'ask'): [number, number][] {
  if (step <= 0) return levels;
  const map = new Map<number, number>();
  for (const [p, q] of levels) {
    const g = dir === 'bid' ? Math.floor(p / step) * step : Math.ceil(p / step) * step;
    map.set(g, (map.get(g) ?? 0) + q);
  }
  const out = [...map.entries()] as [number, number][];
  out.sort((a, b) => (dir === 'bid' ? b[0] - a[0] : a[0] - b[0]));
  return out;
}

function MobileOrderBook({ depth, price, precision, base, quote, changePct }: {
  depth: Depth | null;
  price: number | null;
  precision: number;
  base: string;
  quote: string;
  changePct: number;
}) {
  const { money } = useDisplayPrefs();
  const baseStep = Math.pow(10, -(precision - 1));
  const steps = [baseStep, baseStep * 10, baseStep * 100];
  const [step, setStep] = useState(baseStep);
  useEffect(() => setStep(baseStep), [baseStep]);

  const asks = useMemo(() => groupLevels(depth?.asks ?? [], step, 'ask').slice(0, 6).reverse(), [depth, step]);
  const bids = useMemo(() => groupLevels(depth?.bids ?? [], step, 'bid').slice(0, 6), [depth, step]);
  const maxQty = Math.max(1e-9, ...asks.map(([, q]) => q), ...bids.map(([, q]) => q));

  // Real buy/sell distribution from live depth volumes
  const bidSum = (depth?.bids ?? []).reduce((s, [, q]) => s + q, 0);
  const askSum = (depth?.asks ?? []).reduce((s, [, q]) => s + q, 0);
  const buyPct = bidSum + askSum > 0 ? Math.round((bidSum / (bidSum + askSum)) * 100) : 50;

  const stepLabel = (s: number) => (s >= 1 ? String(s) : s.toFixed(Math.ceil(-Math.log10(s))));

  function Row({ p, q, kind }: { p: number; q: number; kind: 'ask' | 'bid' }) {
    return (
      <div className="relative grid grid-cols-[1fr_auto] gap-1 py-[2.5px]">
        <div
          className={`absolute inset-y-0 right-0 rounded-sm ${kind === 'ask' ? 'bg-down/10' : 'bg-up/10'}`}
          style={{ width: `${Math.min(100, (q / maxQty) * 100)}%` }}
        />
        <span className={`num relative text-[11.5px] font-medium ${kind === 'ask' ? 'text-down' : 'text-up'}`}>
          {fmtPrice(p, precision)}
        </span>
        <span className="num relative text-right text-[11.5px] text-muted">{q.toFixed(4).slice(0, 7)}</span>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex justify-between text-[10px] leading-tight text-muted">
        <span>Price<br />({quote})</span>
        <span className="text-right">Amount<br />({base})</span>
      </div>
      <div className="mt-1.5">
        {asks.map(([p, q], i) => <Row key={`a${i}`} p={p} q={q} kind="ask" />)}
      </div>
      <div className="py-1.5">
        <div className={`num text-[17px] font-bold leading-none ${changePct >= 0 ? 'text-up' : 'text-down'}`}>
          {price ? fmtPrice(price, precision) : '—'}
        </div>
        <div className="num mt-0.5 text-[10px] text-muted">
          ≈ {price ? money(price) : '—'} <span className={changePct >= 0 ? 'text-up' : 'text-down'}>{fmtPct(changePct)}</span>
        </div>
      </div>
      <div>
        {bids.map(([p, q], i) => <Row key={`b${i}`} p={p} q={q} kind="bid" />)}
      </div>

      {/* Buy/Sell distribution (live depth volumes) */}
      <div className="mt-2">
        <div className="flex h-[18px] items-center gap-0.5 overflow-hidden rounded-md text-[10px] font-bold text-[#ffffff]">
          <div className="flex h-full items-center bg-up/90 pl-1.5" style={{ width: `${buyPct}%`, minWidth: '15%' }}>B {buyPct}%</div>
          <div className="flex h-full items-center justify-end bg-down/90 pr-1.5" style={{ width: `${100 - buyPct}%`, minWidth: '15%' }}>{100 - buyPct}% S</div>
        </div>
      </div>

      {/* Price grouping */}
      <select
        value={step}
        onChange={(e) => setStep(Number(e.target.value))}
        className="num mt-2 w-full rounded-lg bg-panel px-2 py-1.5 text-[12px] font-semibold outline-none"
      >
        {steps.map((s) => (
          <option key={s} value={s}>{stepLabel(s)}</option>
        ))}
      </select>
    </div>
  );
}

/* ───────────────────────── Orders / Assets / Bots ───────────────────────── */

function OrdersSection({ symbol, orders, loggedIn, portfolio, money, onChanged }: {
  symbol: string;
  orders: Order[];
  loggedIn: boolean;
  portfolio: Portfolio | null;
  money: (usd: number, d?: number) => string;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<'orders' | 'assets' | 'bots'>('orders');
  const [currentOnly, setCurrentOnly] = useState(false);
  const [busy, setBusy] = useState(false);

  const open = orders.filter((o) => o.status === 'OPEN');
  const shown = (currentOnly ? orders.filter((o) => o.symbol === symbol) : orders).slice(0, 25);
  const eligible = currentOnly ? open.filter((o) => o.symbol === symbol) : open;

  async function cancelOne(id: string) {
    setBusy(true);
    try {
      await post(`/api/orders/${id}`, undefined, 'DELETE');
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  }

  async function cancelAll() {
    if (!confirm(`Cancel ${eligible.length} open order${eligible.length > 1 ? 's' : ''}?`)) return;
    setBusy(true);
    try {
      for (const o of eligible) await post(`/api/orders/${o.id}`, undefined, 'DELETE');
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const cryptoAssets = (portfolio?.assets ?? []).filter((a) => a.asset !== 'GHS');

  return (
    <div className="mt-5 border-t-[6px] border-panel px-4 pt-3">
      <div className="flex items-center gap-5">
        {(
          [
            ['orders', `Orders (${open.length})`],
            ['assets', 'Assets'],
            ['bots', 'Bots (0)'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`pb-1 text-[14px] ${tab === id ? 'font-bold text-foreground' : 'font-medium text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <>
          <div className="mt-2.5 flex items-center justify-between">
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={currentOnly}
                onChange={(e) => setCurrentOnly(e.target.checked)}
                className="h-4 w-4 accent-[#0b0e11]"
              />
              Current symbol
            </label>
            <button
              onClick={cancelAll}
              disabled={busy || eligible.length === 0}
              className="rounded-full bg-panel px-4 py-1.5 text-[12px] font-semibold text-muted disabled:opacity-50"
            >
              Cancel all
            </button>
          </div>
          <div className="mt-2 pb-4">
            {!loggedIn && (
              <EmptyState text="Log in to see your orders" sub="Your open and past orders will appear here." action={{ href: '/m/login', label: 'Log in' }} />
            )}
            {loggedIn && shown.length === 0 && (
              <EmptyState text="No open orders" sub="You don't have any active orders yet." />
            )}
            {shown.map((o) => (
              <div key={o.id} className="border-b border-line/60 py-3 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold">{o.symbol.replace('USDT', '')}<span className="text-muted">/USDT</span></span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${o.side === 'BUY' ? 'bg-up/10 text-up' : 'bg-down/10 text-down'}`}>
                    {o.side}
                  </span>
                  <span className="text-[11px] text-muted">{o.type}</span>
                  <span className={`ml-auto text-[11px] font-bold ${o.status === 'FILLED' ? 'text-up' : o.status === 'CANCELLED' ? 'text-muted' : 'text-gold'}`}>
                    {o.status}
                  </span>
                </div>
                <div className="num mt-1.5 flex flex-wrap gap-x-5 gap-y-0.5 text-[12px] text-muted">
                  <span>Price: <span className="text-foreground">{o.avgFillPrice ? fmtNum(Number(o.avgFillPrice), 4) : o.price ? fmtNum(Number(o.price), 4) : 'Market'}</span></span>
                  <span>Amount: <span className="text-foreground">{fmtNum(Number(o.quantity))}</span></span>
                  <span>Filled: <span className="text-foreground">{fmtNum(Number(o.filledQty))}</span></span>
                  <span>{timeAgo(o.createdAt)}</span>
                </div>
                {o.status === 'OPEN' && (
                  <button
                    onClick={() => cancelOne(o.id)}
                    disabled={busy}
                    className="mt-2 rounded-full border border-line px-4 py-1 text-[12px] font-semibold text-muted disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'assets' && (
        <div className="mt-2 pb-4">
          {!loggedIn || cryptoAssets.length === 0 ? (
            <EmptyState text="No assets found" sub="Deposit or buy crypto to start trading." action={{ href: '/m/deposit', label: 'Add crypto' }} />
          ) : (
            cryptoAssets.map((a) => (
              <div key={a.asset} className="flex items-center gap-3 border-b border-line/60 py-3 last:border-0">
                <CoinIcon asset={a.asset} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold">{a.asset}</div>
                  <div className="num text-[11px] text-muted">{fmtNum(a.total)}</div>
                </div>
                <div className="num text-[14px] font-bold">{money(a.valueUSD)}</div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'bots' && (
        <div className="mt-2 pb-4">
          <EmptyState text="Trading bots coming soon" sub="Automated strategies are not yet available on CediX." />
        </div>
      )}
    </div>
  );
}

function EmptyState({ text, sub, action }: { text: string; sub: string; action?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden>
        <circle cx="38" cy="34" r="17" stroke="currentColor" strokeWidth="2.5" className="text-line" />
        <circle cx="38" cy="34" r="12" stroke="currentColor" strokeWidth="2" className="text-muted" />
        <path d="M38 27v8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-muted" />
        <circle cx="38" cy="40" r="1.4" fill="currentColor" className="text-muted" />
        <rect x="14" y="40" width="14" height="10" rx="2" fill="currentColor" className="text-line" />
        <rect x="17" y="36" width="8" height="3" rx="1" fill="currentColor" className="text-line" />
        <path d="M52 20l3-3M55 23l2-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-line" />
      </svg>
      <div className="mt-3 text-[14px] font-semibold">{text}</div>
      <div className="mt-1 text-[12.5px] text-muted">{sub}</div>
      {action && (
        <Link href={action.href} className="mt-4 rounded-full bg-panel px-6 py-2.5 text-[13px] font-bold">
          {action.label}
        </Link>
      )}
    </div>
  );
}

/* ───────────────────────── Sheets ───────────────────────── */

function PairSheet({ markets, current, onSelect, onClose }: {
  markets: MarketRow[];
  current: string;
  onSelect: (symbol: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const rows = markets.filter(
    (m) => !q || m.base.toLowerCase().includes(q.toLowerCase()) || m.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/60" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full flex-col rounded-t-3xl bg-bg p-4 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[15px] font-bold">Select pair</h3>
          <button onClick={onClose} className="rounded-full bg-panel p-2 text-muted"><IconClose size={14} /></button>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-full bg-panel px-4 py-2.5">
          <IconSearch size={15} className="text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pairs"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </div>
        <div className="mt-2 flex-1 overflow-y-auto">
          {rows.map((m) => (
            <button
              key={m.symbol}
              onClick={() => onSelect(m.symbol)}
              className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left ${m.symbol === current ? 'bg-panel' : ''}`}
            >
              <CoinIcon asset={m.base} size={32} />
              <span className="flex-1 text-[15px] font-bold">
                {m.base}<span className="text-[12px] font-medium text-muted">/{m.quote}</span>
              </span>
              <span className="text-right">
                <span className="num block text-[14px] font-semibold">{fmtPrice(m.price, m.precision)}</span>
                <span className={`num block text-[11px] font-semibold ${m.changePct >= 0 ? 'text-up' : 'text-down'}`}>
                  {fmtPct(m.changePct)}
                </span>
              </span>
            </button>
          ))}
          {rows.length === 0 && <div className="py-10 text-center text-sm text-muted">No pairs found.</div>}
        </div>
      </div>
    </div>
  );
}

function OrderTypeInfo({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/60" onClick={onClose}>
      <div className="w-full rounded-t-3xl bg-bg p-5 pb-10" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <h3 className="text-[15px] font-bold">Order types</h3>
        <div className="mt-3 space-y-3 text-[13px] leading-relaxed">
          <div className="rounded-xl bg-panel p-3.5">
            <div className="font-bold">Market order</div>
            <p className="mt-0.5 text-muted">Executes immediately at the best available market price. You set the amount; the final price follows the live market.</p>
          </div>
          <div className="rounded-xl bg-panel p-3.5">
            <div className="font-bold">Limit order</div>
            <p className="mt-0.5 text-muted">Executes only at your chosen price or better. Your funds are reserved until the order fills or you cancel it.</p>
          </div>
        </div>
        <button onClick={onClose} className="mt-4 w-full rounded-full bg-white py-3 text-[14px] font-bold text-black">
          Got it
        </button>
      </div>
    </div>
  );
}

function ConfirmSheet({ side, type, base, quote, amount, price, feePct, precision, onCancel, onConfirm }: {
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  base: string;
  quote: string;
  amount: number;
  price: number;
  feePct: number;
  precision: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const total = amount * price;
  const fee = total * (feePct / 100);
  const rows: [string, string][] = [
    ['Pair', `${base}/${quote}`],
    ['Side', side === 'BUY' ? 'Buy' : 'Sell'],
    ['Type', type === 'MARKET' ? 'Market order' : 'Limit order'],
    ['Amount', `${fmtNum(amount)} ${base}`],
    [type === 'MARKET' ? 'Est. price' : 'Limit price', `${fmtPrice(price, precision)} ${quote}`],
    [`Fee (${feePct}%)`, `${fmtNum(fee, 4)} ${quote}`],
    ['Est. total', `${fmtNum(side === 'BUY' ? total + fee : total - fee, 2)} ${quote}`],
  ];
  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/60" onClick={onCancel}>
      <div className="w-full rounded-t-3xl bg-bg p-5 pb-9" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <h3 className="text-center text-[15px] font-bold">Confirm {side === 'BUY' ? 'buy' : 'sell'} order</h3>
        <div className="num mt-4 space-y-2.5 rounded-2xl bg-panel p-4 text-[13.5px]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-muted">{k}</span>
              <span className="font-semibold">{v}</span>
            </div>
          ))}
        </div>
        {type === 'MARKET' && (
          <p className="mt-2 px-1 text-[11px] text-muted">
            Market orders execute at the live price, which may differ slightly from the estimate.
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={onCancel} className="rounded-full bg-panel py-3 text-[14px] font-bold">
            Cancel
          </button>
          <button
            onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }}
            disabled={busy}
            className={`rounded-full py-3 text-[14px] font-bold text-[#ffffff] disabled:opacity-50 ${side === 'BUY' ? 'bg-up' : 'bg-down'}`}
          >
            {busy ? 'Placing…' : `Confirm ${side === 'BUY' ? 'buy' : 'sell'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
