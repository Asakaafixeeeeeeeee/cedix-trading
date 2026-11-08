'use client';
import Link from 'next/link';
import { useState } from 'react';
import MarketTable from '@/components/MarketTable';
import { usePoll, useUser } from '@/lib/hooks';
import { fmtGHS, fmtUSD } from '@/lib/format';
import type { Portfolio } from '@/lib/wallet';

function QuickAction({ href, label, icon, primary = false }: { href: string; label: string; icon: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
        primary ? 'bg-white text-black hover:bg-gray-200' : 'border border-line bg-panel2 hover:border-accent'
      }`}
    >
      <span>{icon}</span> {label}
    </Link>
  );
}

function PortfolioHeader() {
  const { data } = usePoll<Portfolio>('/api/portfolio', 10000);
  const [hidden, setHidden] = useState(false);

  return (
    <section className="mb-6 rounded-xl border border-line bg-gradient-to-br from-panel to-panel2 p-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted">
            Total Portfolio Value
            <button onClick={() => setHidden((v) => !v)} className="hover:text-white" title="Toggle visibility">
              {hidden ? '🙈' : '👁'}
            </button>
          </div>
          <div className="num mt-1 text-4xl font-bold">
            {hidden ? '••••••' : data ? fmtUSD(data.totalUSD) : '—'}
          </div>
          <div className="num mt-1 text-lg text-muted">
            {hidden ? '••••••' : data ? `≈ ${fmtGHS(data.totalGHS)}` : ''}
            {data && !hidden && (
              <span className="ml-2 text-xs">@ {data.ghsPerUsd.toFixed(2)} GHS/USD</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <QuickAction href="/deposit" label="Deposit" icon="💳" primary />
          <QuickAction href="/p2p" label="P2P Trading" icon="🤝" />
          <QuickAction href="/withdraw" label="Withdraw" icon="🏦" />
          <QuickAction href="/trade/BTCUSDT" label="Trade" icon="📈" />
        </div>
      </div>
    </section>
  );
}

function Hero() {
  return (
    <section className="mb-8 py-14 text-center">
      <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-tight tracking-tight">
        Trade Crypto with <span className="text-up">Ghanaian Cedis</span>
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
        Buy Bitcoin with MoMo in minutes. Withdraw straight to your mobile money — no selling step
        needed. Spot trading, P2P, staking and the Orbit community, all in one place.
      </p>
      <div className="mt-8 flex justify-center gap-4">
        <Link href="/register" className="rounded-lg bg-white px-8 py-3 font-semibold text-black hover:bg-gray-200">
          Get Started
        </Link>
        <Link href="/markets" className="rounded-lg border border-line px-8 py-3 font-semibold hover:border-accent">
          Explore Markets
        </Link>
      </div>
      <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-4 text-left md:grid-cols-4">
        {[
          ['💳', 'MoMo Deposits', 'MTN, Telecel & AT via Payteller'],
          ['🏦', 'Direct Fiat Withdrawal', 'Crypto → GH₵ in one step'],
          ['🤝', 'P2P Marketplace', 'Trade with verified Ghanaians'],
          ['🛡️', 'AI Moderation', 'Fraud blocked automatically'],
        ].map(([icon, title, sub]) => (
          <div key={title} className="rounded-xl border border-line bg-panel p-4">
            <div className="text-2xl">{icon}</div>
            <div className="mt-2 text-sm font-semibold">{title}</div>
            <div className="mt-1 text-xs text-muted">{sub}</div>
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
