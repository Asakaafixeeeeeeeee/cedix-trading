'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { usePoll } from '@/lib/hooks';
import { fmtCompact, fmtPct, fmtPrice } from '@/lib/format';
import type { MarketRow } from '@/components/MarketTable';
import CoinIcon from '@/components/CoinIcon';
import { IconSearch, IconClose } from '@/components/icons';

const TABS = [
  { id: 'favorites', label: 'Favorites' },
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
    if (search) {
      const s = search.toLowerCase();
      r = r.filter((m) => m.base.toLowerCase().includes(s) || m.name.toLowerCase().includes(s));
    } else if (tab === 'favorites') r = r.filter((m) => m.favorite);
    else r = r.filter((m) => m.category === tab);
    return r;
  }, [data, tab, search]);

  return (
    <div className="px-4 pt-3">
      <div className="flex items-center justify-between">
        <h1 className="text-[17px] font-bold">Markets</h1>
        <div className="flex gap-1 rounded-full bg-panel p-1">
          {(['spot', 'futures'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-3.5 py-1 text-xs font-bold capitalize ${mode === m ? 'bg-bg shadow-sm' : 'text-muted'}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-full bg-panel px-4 py-2.5">
        <IconSearch size={16} className="shrink-0 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search coins"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
        />
        {search && <button onClick={() => setSearch('')} className="text-muted"><IconClose size={14} /></button>}
      </div>

      <div className="no-scrollbar -mx-4 mt-3 flex gap-1 overflow-x-auto px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
              tab === t.id && !search ? 'bg-panel text-foreground' : 'text-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-2">
        {rows.length === 0 && <div className="py-16 text-center text-sm text-muted">Nothing here yet.</div>}
        {rows.map((m) => (
          <Link key={m.symbol} href={`/m/trade/${m.symbol}`} className="flex items-center gap-3 py-[9px] active:opacity-70">
            <CoinIcon asset={m.base} size={34} />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold">
                {m.base} <span className="text-[12px] font-medium text-muted">/ {m.quote}</span>
              </div>
              <div className="num mt-0.5 text-[11px] text-muted">${fmtCompact(m.quoteVolume)}</div>
            </div>
            <div className="mr-1 text-right">
              <div className="num text-[14px] font-semibold">{fmtPrice(m.price, m.precision)}</div>
              <div className="mt-0.5 truncate text-[10.5px] text-muted">{m.name}</div>
            </div>
            <span
              className={`num w-[64px] shrink-0 rounded-md py-1.5 text-center text-[12px] font-bold text-[#ffffff] ${
                m.changePct >= 0 ? 'bg-up' : 'bg-down'
              }`}
            >
              {fmtPct(m.changePct)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
