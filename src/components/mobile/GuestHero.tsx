'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { usePoll } from '@/lib/hooks';
import { fmtPct, fmtPrice } from '@/lib/format';
import type { MarketRow } from '@/components/MarketTable';
import CoinIcon from '@/components/CoinIcon';
import { IconSearch } from '@/components/icons';

/**
 * Logged-out home hero (OKX-style splash). Everything inside the framed
 * preview card is REAL market data — prices, % moves and the BTC chart are
 * live; no invented balances are shown.
 */

const RANGES = [
  { id: '1D', interval: '15m', limit: 96 },
  { id: '1W', interval: '2h', limit: 84 },
  { id: '1M', interval: '8h', limit: 90 },
  { id: '6M', interval: '1d', limit: 180 },
] as const;

const TABS = ['Favorites', 'Top', 'Hot', 'Gainers', 'New'] as const;

type Kline = { time: number; close: number };

function Spark({ points, up }: { points: number[]; up: boolean }) {
  if (points.length < 2) return <div className="h-[92px]" />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const W = 300;
  const H = 92;
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${((i / (points.length - 1)) * W).toFixed(1)},${(H - 6 - ((p - min) / (max - min || 1)) * (H - 12)).toFixed(1)}`)
    .join(' ');
  const color = up ? '#9fe635' : '#f14e5c';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[92px] w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="ghero" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${W},${H} L0,${H} Z`} fill="url(#ghero)" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}

export default function GuestHero({ markets }: { markets: MarketRow[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[0]);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Hot');
  const { data: klineData } = usePoll<{ klines: Kline[] }>(`/api/markets/klines?symbol=BTCUSDT&interval=${range.interval}&limit=${range.limit}`, 30000);

  const closes = useMemo(() => (klineData?.klines ?? []).map((k) => Number(k.close)), [klineData]);
  const btc = markets.find((m) => m.base === 'BTC');
  const chartUp = closes.length > 1 ? closes[closes.length - 1] >= closes[0] : true;

  const rows = useMemo(() => {
    const crypto = markets.filter((m) => m.category === 'crypto');
    if (tab === 'Gainers') return [...crypto].sort((a, b) => b.changePct - a.changePct).slice(0, 5);
    if (tab === 'New') return crypto.slice(-5);
    if (tab === 'Favorites' || tab === 'Top') return crypto.slice(0, 5);
    return crypto.slice(0, 5); // Hot
  }, [markets, tab]);

  return (
    <div className="pb-6 pt-4">
      {/* Hero copy */}
      <h1 className="text-center text-[30px] font-extrabold leading-tight tracking-tight">
        A New
        <br />
        Alternative
      </h1>
      <p className="mt-1.5 text-center text-[12px] font-semibold tracking-wide text-muted">
        To Your Crypto Journey
      </p>

      {/* Framed live-market preview card */}
      <div className="mx-auto mt-5 max-w-[320px] rounded-[30px] border-2 border-line bg-panel p-3.5">
        <Link href="/m/markets" className="flex items-center gap-2 rounded-full bg-panel2 px-3 py-1.5">
          <IconSearch size={12} className="text-muted" />
          <span className="text-[11px] text-muted">Search</span>
        </Link>

        <div className="mt-3 px-1">
          <p className="text-[10px] text-muted">BTC/USDT · live</p>
          <p className="num text-[20px] font-bold leading-tight">
            {btc ? fmtPrice(btc.price) : '…'}
            <span className="ml-1 text-[11px] font-semibold text-muted">USDT</span>
          </p>
          <p className={`num text-[11px] font-semibold ${btc && btc.changePct >= 0 ? 'text-up' : 'text-down'}`}>
            {btc ? `${fmtPct(btc.changePct)} Today` : ''}
          </p>
        </div>

        <div className="mt-1">
          <Spark points={closes} up={chartUp} />
        </div>

        <div className="mt-1 flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r)}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${range.id === r.id ? 'bg-white text-black' : 'text-muted'}`}
            >
              {r.id}
            </button>
          ))}
        </div>

        <div className="mt-2.5 flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold ${tab === t ? 'bg-panel2 text-foreground' : 'text-muted'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-1.5 space-y-0.5">
          {rows.map((m) => (
            <Link key={m.symbol} href={`/m/trade/${m.symbol}`} className="flex items-center justify-between rounded-lg px-1 py-1.5">
              <span className="flex items-center gap-2">
                <CoinIcon asset={m.base} size={18} />
                <span className="text-[11px] font-bold">
                  {m.base} <span className="font-medium text-muted">/ USDT</span>
                </span>
              </span>
              <span
                className={`num min-w-[56px] rounded-md px-1.5 py-1 text-center text-[10px] font-bold text-[#ffffff] ${
                  m.changePct >= 0 ? 'bg-[#16a34a]' : 'bg-[#e4426c]'
                }`}
              >
                {fmtPct(m.changePct)}
              </span>
            </Link>
          ))}
          {rows.length === 0 && <p className="py-4 text-center text-[11px] text-muted">Loading live markets…</p>}
        </div>
      </div>

      {/* Auth actions */}
      <div className="mx-auto mt-6 flex max-w-[360px] gap-3 px-1">
        <Link
          href="/m/login"
          className="flex-1 rounded-full bg-[#15803d] py-3 text-center text-[14px] font-bold text-[#ffffff]"
        >
          Log in
        </Link>
        <Link
          href="/register"
          className="flex-1 rounded-full bg-[#b9f24d] py-3 text-center text-[14px] font-bold text-[#0a0a0a]"
        >
          Sign up
        </Link>
      </div>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
        Explore markets, charts and Orbit without an account.
        <br />
        Sign up to deposit, trade and manage your assets.
      </p>
    </div>
  );
}
