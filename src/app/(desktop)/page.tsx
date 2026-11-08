'use client';
import Link from 'next/link';
import { useState } from 'react';
import MarketTable from '@/components/MarketTable';
import { usePoll, useUser } from '@/lib/hooks';
import { useDisplayPrefs } from '@/lib/prefs';
import { fmtGHS, fmtUSD } from '@/lib/format';
import type { Portfolio } from '@/lib/wallet';
import {
  IconDeposit, IconWithdraw, IconP2P, IconCandles, IconEye, IconEyeOff,
  IconShield, IconWallet, IconEarn,
} from '@/components/icons';

function QuickAction({ href, label, icon, primary = false }: { href: string; label: string; icon: React.ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
        primary ? 'bg-white text-black hover:bg-gray-200' : 'border border-line bg-panel2 hover:border-accent'
      }`}
    >
      {icon} {label}
    </Link>
  );
}

function PortfolioHeader() {
  const { data } = usePoll<Portfolio>('/api/portfolio', 10000);
  const { currency, rate, money } = useDisplayPrefs();
  const [hidden, setHidden] = useState(false);

  return (
    <section className="mb-6 rounded-2xl border border-line bg-panel p-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted">
            Total Portfolio Value
            <button onClick={() => setHidden((v) => !v)} className="p-0.5 hover:text-foreground" title="Toggle visibility">
              {hidden ? <IconEyeOff size={15} /> : <IconEye size={15} />}
            </button>
          </div>
          <div className="num mt-1 text-4xl font-bold">
            {hidden ? '••••••' : data ? money(data.totalUSD) : '—'}
          </div>
          <div className="num mt-1 text-lg text-muted">
            {hidden
              ? '••••••'
              : data
                ? currency === 'GHS'
                  ? `≈ ${fmtUSD(data.totalUSD)}`
                  : rate
                    ? `≈ ${fmtGHS(data.totalUSD * rate)}`
                    : ''
                : ''}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <QuickAction href="/deposit" label="Deposit" icon={<IconDeposit size={17} />} primary />
          <QuickAction href="/p2p" label="P2P Trading" icon={<IconP2P size={17} />} />
          <QuickAction href="/withdraw" label="Withdraw" icon={<IconWithdraw size={17} />} />
          <QuickAction href="/trade/BTCUSDT" label="Trade" icon={<IconCandles size={17} />} />
        </div>
      </div>
    </section>
  );
}

function Hero() {
  return (
    <section className="mb-8 py-14 text-center">
      <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-tight tracking-tight">
        Trade Crypto with <span className="text-up">Confidence</span>
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
        Explore cryptocurrency markets, manage your digital assets, and access powerful trading tools
        in one secure platform.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link href="/register" className="rounded-full bg-white px-8 py-3 font-semibold text-black hover:bg-gray-200">
          Get Started
        </Link>
        <Link href="/markets" className="rounded-full border border-line px-8 py-3 font-semibold hover:border-accent">
          Explore Markets
        </Link>
        <Link href="/login" className="rounded-full border border-line px-8 py-3 font-semibold text-muted hover:border-accent hover:text-foreground">
          Sign In
        </Link>
      </div>
      <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-4 text-left md:grid-cols-4">
        {[
          { icon: <IconCandles size={22} />, title: 'Spot Trading', sub: 'Live charts & order books' },
          { icon: <IconP2P size={22} />, title: 'P2P Marketplace', sub: 'Escrow-protected trades' },
          { icon: <IconEarn size={22} />, title: 'Earn Products', sub: 'Staking & savings' },
          { icon: <IconShield size={22} />, title: 'Secure Platform', sub: 'Verified accounts & audit trails' },
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border border-line bg-panel p-4">
            <span className="inline-flex rounded-xl bg-panel2 p-2.5 text-foreground">{f.icon}</span>
            <div className="mt-3 text-sm font-semibold">{f.title}</div>
            <div className="mt-1 text-xs text-muted">{f.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  const { user, loading } = useUser();
  return (
    <div className="pt-6">
      {loading ? <div className="h-40" /> : user ? <PortfolioHeader /> : <Hero />}
      <h2 className="mb-3 text-xl font-bold">Market Overview</h2>
      <MarketTable />
    </div>
  );
}
