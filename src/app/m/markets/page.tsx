'use client';
import { useMemo, useState } from 'react';
import { usePoll } from '@/lib/hooks';
import type { MarketRow } from '@/components/MarketTable';
import { MarketRowItem } from '../page';

const TABS = [
  { id: 'favorites', label: '★' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'new', label: 'New' },
  { id: 'stock', label: 'Stocks' },
  { id: 'etf', label: 'ETFs' },
];

export default function MobileMarkets() {
  const [tab, setTab] = useState('crypto');
  const [mode, setMode] = useState<'spot' | 'futures'>('spot');
  const [search, setSearch] = useState('');
  const { data } = usePoll<{ markets: MarketRow[] }>(`/api/markets?type=${mode}`, 5000);

  const rows = useMemo(() => {
    let r = data?.markets ?? [];
    if (tab === 'favorites') r = r.filter((m) => m.favorite);
    else r = r.filter((m) => m.category === tab);
    if (search) {
      const s = search.toLowerCase();
      r = r.filter((m) => m.base.toLowerCase().includes(s) || m.name.toLowerCase().includes(s));
    }
    return r;
  }, [data, tab, search]);

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Markets</h1>
        <div className="flex overflow-hidden rounded-lg border border-line text-xs">
          <button onClick={() => setMode('spot')} className={`px-3 py-1.5 ${mode === 'spot' ? 'bg-white font-semibold text-black' : 'text-muted'}`}>
            Spot
          </button>
          <button onClick={() => setMode('futures')} className={`px-3 py-1.5 ${mode === 'futures' ? 'bg-white font-semibold text-black' : 'text-muted'}`}>
            Futures
          </button>
        </div>
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Search coins"
        className="mt-3 w-full rounded-xl border border-line bg-panel px-4 py-2.5 text-sm outline-none focus:border-accent"
      />
      <div className="-mx-4 mt-3 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold ${
              tab === t.id ? 'bg-white text-black' : 'bg-panel text-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-3 space-y-0.5">
        {rows.map((m) => (
          <MarketRowItem key={m.symbol} m={m} />
        ))}
        {rows.length === 0 && <div className="py-16 text-center text-sm text-muted">Nothing here yet.</div>}
      </div>
    </div>
  );
}
