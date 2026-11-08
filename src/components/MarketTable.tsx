'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { usePoll, post, useUser } from '@/lib/hooks';
import { fmtCompact, fmtPct, fmtPrice } from '@/lib/format';

export type MarketRow = {
  symbol: string;
  base: string;
  quote: string;
  name: string;
  category: 'crypto' | 'new' | 'stock' | 'etf';
  color: string;
  precision: number;
  price: number;
  changePct: number;
  high: number;
  low: number;
  volume: number;
  quoteVolume: number;
  favorite: boolean;
};

const TABS = [
  { id: 'favorites', label: '★ Favorites' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'new', label: 'New' },
  { id: 'stock', label: 'Stocks' },
  { id: 'etf', label: 'ETFs' },
] as const;

export default function MarketTable({ compact = false }: { compact?: boolean }) {
  const [tab, setTab] = useState<string>('crypto');
  const [mode, setMode] = useState<'spot' | 'futures'>('spot');
  const [search, setSearch] = useState('');
  const { user } = useUser();
  const { data, refresh } = usePoll<{ markets: MarketRow[] }>(`/api/markets?type=${mode}`, 5000);

  const rows = useMemo(() => {
    let r = data?.markets ?? [];
    if (tab === 'favorites') r = r.filter((m) => m.favorite);
    else r = r.filter((m) => m.category === tab);
    if (search) {
      const s = search.toLowerCase();
      r = r.filter((m) => m.base.toLowerCase().includes(s) || m.name.toLowerCase().includes(s));
    }
    return compact ? r.slice(0, 8) : r;
  }, [data, tab, search, compact]);

  async function toggleFav(e: React.MouseEvent, symbol: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    await post('/api/favorites', { symbol });
    refresh();
  }

  return (
    <div className="rounded-xl border border-line bg-panel">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === t.id ? 'bg-panel2 text-white' : 'text-muted hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {!compact && (
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-40 rounded-md border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
          )}
          <div className="flex overflow-hidden rounded-md border border-line text-sm">
            <button
              onClick={() => setMode('spot')}
              className={`px-3 py-1.5 ${mode === 'spot' ? 'bg-white font-semibold text-black' : 'text-muted'}`}
            >
              Spot
            </button>
            <button
              onClick={() => setMode('futures')}
              className={`px-3 py-1.5 ${mode === 'futures' ? 'bg-white font-semibold text-black' : 'text-muted'}`}
            >
              Futures
            </button>
          </div>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-2.5 pl-4 font-medium">Name</th>
            <th className="font-medium">Last Price</th>
            <th className="font-medium">24h Change</th>
            {!compact && <th className="hidden font-medium lg:table-cell">24h High / Low</th>}
            <th className="hidden font-medium md:table-cell">24h Volume</th>
            <th className="pr-4 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="py-10 text-center text-muted">
                {tab === 'favorites'
                  ? user
                    ? 'No favorites yet — tap the star on any market.'
                    : 'Log in to track your favorite markets.'
                  : mode === 'futures' && (tab === 'stock' || tab === 'etf')
                    ? 'Futures are available for crypto markets only.'
                    : 'Loading markets…'}
              </td>
            </tr>
          )}
          {rows.map((m) => (
            <tr key={m.symbol} className="border-t border-line/60 hover:bg-panel2/60">
              <td className="py-3 pl-4">
                <Link href={`/trade/${m.symbol}`} className="flex items-center gap-3">
                  <button
                    onClick={(e) => toggleFav(e, m.symbol)}
                    className={`text-base ${m.favorite ? 'text-gold' : 'text-line hover:text-muted'}`}
                    title="Favorite"
                  >
                    ★
                  </button>
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: m.color }}
                  >
                    {m.base.slice(0, 3)}
                  </span>
                  <span>
                    <span className="font-semibold">{m.base}</span>
                    <span className="text-muted">/{m.quote}</span>
                    <div className="text-xs text-muted">{m.name}</div>
                  </span>
                </Link>
              </td>
              <td className="num font-medium">${fmtPrice(m.price, m.precision)}</td>
              <td className={`num font-medium ${m.changePct >= 0 ? 'text-up' : 'text-down'}`}>{fmtPct(m.changePct)}</td>
              {!compact && (
                <td className="num hidden text-muted lg:table-cell">
                  {fmtPrice(m.high, m.precision)} / {fmtPrice(m.low, m.precision)}
                </td>
              )}
              <td className="num hidden text-muted md:table-cell">${fmtCompact(m.quoteVolume)}</td>
              <td className="pr-4 text-right">
                <Link
                  href={`/trade/${m.symbol}`}
                  className="rounded-md border border-line px-3 py-1 text-xs font-medium hover:border-accent hover:text-accent"
                >
                  Trade
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
