'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usePoll, useUser } from '@/lib/hooks';
import { useDisplayPrefs } from '@/lib/prefs';
import { fmtGHS, fmtPct, fmtPrice, fmtUSD } from '@/lib/format';
import type { Portfolio } from '@/lib/wallet';
import type { MarketRow } from '@/components/MarketTable';
import CoinIcon from '@/components/CoinIcon';
import { IconDeposit, IconWithdraw, IconP2P, IconEarn, IconEye, IconEyeOff } from '@/components/icons';

export default function MobileHome() {
  const { user, loading } = useUser();
  const { currency, rate, money } = useDisplayPrefs();
  const { data: portfolio } = usePoll<Portfolio>(user ? '/api/portfolio' : null, 10000);
  const { data: markets } = usePoll<{ markets: MarketRow[] }>('/api/markets?type=spot', 6000);
  const [hidden, setHidden] = useState(false);

  const top = (markets?.markets ?? []).filter((m) => m.category === 'crypto').slice(0, 6);
  const movers = [...(markets?.markets ?? [])].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 8);

  return (
    <div className="px-4 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white font-black text-black">C</span>
          <span className="text-lg font-bold">CediX</span>
        </div>
        {user ? (
          <Link href="/m/assets" className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold">
            {(user.displayName || user.username).slice(0, 1).toUpperCase()}
          </Link>
        ) : (
          !loading && (
            <Link href="/m/login" className="rounded-lg bg-white px-4 py-1.5 text-sm font-semibold text-black">
              Log in
            </Link>
          )
        )}
      </div>

      {/* Portfolio card */}
      {user ? (
        <div className="mt-4 rounded-2xl bg-panel p-5 ring-1 ring-line">
          <div className="flex items-center gap-2 text-xs text-muted">
            Total Balance
            <button onClick={() => setHidden((v) => !v)} className="p-0.5">{hidden ? <IconEyeOff size={15} /> : <IconEye size={15} />}</button>
          </div>
          <div className="num mt-1 text-3xl font-bold">
            {hidden ? '••••••' : portfolio ? money(portfolio.totalUSD) : '—'}
          </div>
          <div className="num text-sm text-muted">
            {hidden
              ? ''
              : portfolio
                ? currency === 'GHS'
                  ? `≈ ${fmtUSD(portfolio.totalUSD)}`
                  : rate
                    ? `≈ ${fmtGHS(portfolio.totalUSD * rate)}`
                    : ''
                : ''}
          </div>
        </div>
      ) : (
        !loading && (
          <div className="mt-4 rounded-2xl bg-panel p-5 text-center ring-1 ring-line">
            <div className="text-lg font-bold">Trade crypto with GH₵</div>
            <p className="mt-1 text-xs text-muted">MoMo deposits · P2P · instant fiat withdrawals</p>
            <Link href="/m/login" className="mt-3 inline-block rounded-lg bg-white px-6 py-2 text-sm font-semibold text-black">
              Get Started
            </Link>
          </div>
        )
      )}

      {/* Quick actions */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          { href: '/m/deposit', icon: <IconDeposit size={20} />, label: 'Deposit' },
          { href: '/m/withdraw', icon: <IconWithdraw size={20} />, label: 'Withdraw' },
          { href: '/p2p', icon: <IconP2P size={20} />, label: 'P2P' },
          { href: '/m/explore', icon: <IconEarn size={20} />, label: 'Earn' },
        ].map((a) => (
          <Link key={a.label} href={a.href} className="flex flex-col items-center gap-1.5 rounded-xl bg-panel py-3.5 text-foreground">
            {a.icon}
            <span className="text-[11px] font-medium text-muted">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Top movers carousel */}
      <h2 className="mt-6 text-sm font-bold text-muted">Top Movers</h2>
      <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {movers.map((m) => (
          <Link
            key={m.symbol}
            href={`/m/trade/${m.symbol}`}
            className="min-w-[124px] shrink-0 rounded-xl bg-panel p-3"
          >
            <div className="text-xs font-semibold">{m.base}</div>
            <div className="num mt-1 text-sm font-bold">${fmtPrice(m.price, m.precision)}</div>
            <div className={`num text-xs font-semibold ${m.changePct >= 0 ? 'text-up' : 'text-down'}`}>
              {fmtPct(m.changePct)}
            </div>
          </Link>
        ))}
      </div>

      {/* Market list */}
      <div className="mt-5 flex items-center justify-between">
        <h2 className="text-sm font-bold text-muted">Markets</h2>
        <Link href="/m/markets" className="text-xs text-accent">
          See all →
        </Link>
      </div>
      <div className="mt-2 space-y-1">
        {top.map((m) => (
          <MarketRowItem key={m.symbol} m={m} />
        ))}
      </div>
    </div>
  );
}

export function MarketRowItem({ m }: { m: MarketRow }) {
  return (
    <Link href={`/m/trade/${m.symbol}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 active:bg-panel">
      <CoinIcon asset={m.base} size={36} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">
          {m.base}
          <span className="text-xs text-muted">/{m.quote}</span>
        </div>
        <div className="truncate text-xs text-muted">{m.name}</div>
      </div>
      <div className="text-right">
        <div className="num text-sm font-semibold">${fmtPrice(m.price, m.precision)}</div>
        <div className={`num text-xs font-semibold ${m.changePct >= 0 ? 'text-up' : 'text-down'}`}>{fmtPct(m.changePct)}</div>
      </div>
    </Link>
  );
}
