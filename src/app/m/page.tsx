'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePoll, useUser } from '@/lib/hooks';
import { useDisplayPrefs } from '@/lib/prefs';
import { fmtCompact, fmtPct, fmtPrice } from '@/lib/format';
import type { Portfolio } from '@/lib/wallet';
import type { MarketRow } from '@/components/MarketTable';
import CoinIcon from '@/components/CoinIcon';
import HomeSections from '@/components/mobile/HomeSections';
import GuestHero from '@/components/mobile/GuestHero';
import {
  IconMenu, IconScan, IconSearch, IconEye, IconEyeOff, IconChevronRight, IconChevronDown,
  IconGear, IconClock, IconClose,
} from '@/components/icons';

type Banner = { id: string; title: string; body: string; link: string | null };

const TABS = [
  { id: 'favorites', label: 'Favorites' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'new', label: 'New' },
  { id: 'stock', label: 'Stocks' },
  { id: 'etf', label: 'ETFs' },
];

export default function MobileHome() {
  const { user, loading } = useUser();
  const { currency, rate, money } = useDisplayPrefs();
  const { data: portfolio } = usePoll<Portfolio>(user ? '/api/portfolio' : null, 10000);
  const [mode, setMode] = useState<'spot' | 'futures'>('spot');
  const { data: markets } = usePoll<{ markets: MarketRow[] }>(`/api/markets?type=${mode}`, 6000);
  const { data: bannerData } = usePoll<{ banners: Banner[] }>('/api/banners', 0);
  const [hidden, setHidden] = useState(false);
  const [tab, setTab] = useState('crypto');
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [bannerIdx, setBannerIdx] = useState(0);

  const banners = bannerData?.banners ?? [];
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % banners.length), 6000);
    return () => clearInterval(t);
  }, [banners.length]);

  const rows = useMemo(() => {
    let r = markets?.markets ?? [];
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      r = r.filter((m) => m.base.toLowerCase().includes(s) || m.name.toLowerCase().includes(s));
    } else if (tab === 'favorites') r = r.filter((m) => m.favorite);
    else r = r.filter((m) => m.category === tab);
    return r.slice(0, 20);
  }, [markets, tab, search]);

  const totalUSD = portfolio?.totalUSD ?? 0;
  const displayValue = currency === 'GHS' && rate ? totalUSD * rate : totalUSD;
  const pnl = portfolio?.pnl24hUSD ?? 0;
  const pnlUp = pnl >= 0;

  return (
    <div className="px-4 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between py-1.5">
        <button onClick={() => setMenuOpen(true)} className="p-1.5 text-foreground" aria-label="Menu">
          <IconMenu size={20} />
        </button>
        <div className="flex items-center gap-1 rounded-full bg-panel p-1">
          <span className="rounded-full bg-bg px-3.5 py-1 text-[13px] font-bold shadow-sm">Exchange</span>
          <span className="flex items-center gap-1 px-2.5 py-1 text-[13px] font-medium text-muted" title="Coming soon">
            Web3
            <span className="rounded bg-panel2 px-1 py-0.5 text-[9px] font-bold uppercase">Soon</span>
          </span>
        </div>
        {user ? (
          <Link
            href="/m/assets"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-[#ffffff]"
            aria-label="Account"
          >
            {(user.displayName || user.username).slice(0, 1).toUpperCase()}
          </Link>
        ) : (
          <Link href="/m/login" className="rounded-full bg-white px-3.5 py-1 text-[13px] font-bold text-black">
            Log in
          </Link>
        )}
      </div>

      {/* Logged-out: OKX-style splash with live market preview */}
      {!loading && !user ? (
        <>
          <GuestHero markets={markets?.markets ?? []} />
          {menuOpen && <MenuSheet isAdmin={false} loggedIn={false} onClose={() => setMenuOpen(false)} />}
        </>
      ) : (
        <>
      {/* Search */}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-full bg-panel px-4 py-2.5">
          <IconSearch size={16} className="shrink-0 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search coins and pairs"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-muted"><IconClose size={14} /></button>
          )}
        </div>
        <button onClick={() => setScanOpen(true)} className="rounded-full bg-panel p-2.5 text-foreground" aria-label="Scan QR">
          <IconScan size={18} />
        </button>
      </div>

      {/* Balance */}
      {user && (
        <div className="mt-4">
          <div className="flex items-center gap-1.5 text-[12px] text-muted">
            Est total value
            <button onClick={() => setHidden((v) => !v)} className="p-0.5" aria-label="Toggle balance">
              {hidden ? <IconEyeOff size={15} /> : <IconEye size={15} />}
            </button>
          </div>
          <Link href="/m/assets" className="mt-0.5 flex items-end gap-1.5">
            <span className="num text-[27px] font-bold leading-none tracking-tight">
              {hidden ? '******' : displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="mb-0.5 flex items-center text-[13px] font-semibold">
              {currency} <IconChevronDown size={12} className="text-muted" />
            </span>
          </Link>
          <Link href="/m/assets/history" className="mt-1 flex items-center gap-1 text-[12px]">
            <span className="border-b border-dashed border-line text-muted">Today&apos;s PnL</span>
            <span className={`num font-semibold ${pnlUp ? 'text-up' : 'text-down'}`}>
              {hidden ? '****' : `${pnlUp ? '+' : '-'}${money(Math.abs(pnl))} (${pnlUp ? '+' : ''}${(portfolio?.pnl24hPct ?? 0).toFixed(2)}%)`}
            </span>
            <IconChevronRight size={12} className="text-muted" />
          </Link>
        </div>
      )}
      {!loading && !user && (
        <div className="mt-4">
          <h1 className="text-[21px] font-bold leading-tight">Trade Crypto with Confidence</h1>
          <p className="mt-1 text-[13px] text-muted">
            Live markets, powerful tools and secure asset management in one platform.
          </p>
        </div>
      )}

      {/* Primary actions */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link
          href={user ? '/m/deposit' : '/m/login'}
          className="rounded-full bg-[#0B4F3F] py-2.5 text-center text-[13.5px] font-bold text-[#ffffff] transition active:scale-[0.98] dark:bg-up"
        >
          Deposit crypto
        </Link>
        <Link
          href="/p2p"
          className="rounded-full bg-[#0B4F3F] py-2.5 text-center text-[13.5px] font-bold text-[#ffffff] transition active:scale-[0.98] dark:bg-up"
        >
          P2P trading
        </Link>
      </div>

      {/* Promotional banner */}
      {banners.length > 0 && (
        <div className="mt-4">
          {banners.map((b, i) =>
            i === bannerIdx ? (
              <Link key={b.id} href={b.link || '#'} className="flex items-center gap-3 rounded-2xl bg-panel p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-[14px] font-semibold">
                    {b.title} <IconChevronRight size={14} className="text-muted" />
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[12px] text-muted">{b.body}</div>
                </div>
              </Link>
            ) : null,
          )}
          {banners.length > 1 && (
            <div className="mt-2 flex justify-center gap-1.5">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  onClick={() => setBannerIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${i === bannerIdx ? 'w-4 bg-up' : 'w-1.5 bg-line'}`}
                  aria-label={`Banner ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Market categories */}
      <div className="no-scrollbar -mx-4 mt-5 flex gap-1 overflow-x-auto px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSearch(''); }}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
              tab === t.id && !search ? 'bg-panel text-foreground' : 'text-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-1 px-1">
        {(['spot', 'futures'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-3 py-1 text-[11.5px] font-bold capitalize ${
              mode === m ? 'bg-white text-black' : 'text-muted'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Market list */}
      <div className="mt-1">
        {rows.length === 0 && (
          <div className="py-14 text-center text-sm text-muted">
            {search
              ? 'No matches found.'
              : tab === 'favorites'
                ? 'No favorites yet — star markets on the Markets page.'
                : mode === 'futures'
                  ? 'Futures are available for crypto markets only.'
                  : 'Loading markets…'}
          </div>
        )}
        {rows.map((m) => (
          <Link key={m.symbol} href={`/m/trade/${m.symbol}`} className="flex items-center gap-3 py-[9px] active:opacity-70">
            <CoinIcon asset={m.base} size={34} />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold">
                {m.base} <span className="text-[12px] font-medium text-muted">/ {m.quote}</span>
              </div>
              <div className="num mt-0.5 text-[10.5px] text-muted">${fmtCompact(m.quoteVolume)}</div>
            </div>
            <div className="mr-1 text-right">
              <div className="num text-[14px] font-semibold">{fmtPrice(m.price, m.precision)}</div>
              <div className="num mt-0.5 text-[10.5px] text-muted">
                {currency === 'GHS' && rate ? `GH₵${fmtPrice(m.price * rate, 2)}` : `$${fmtPrice(m.price, m.precision)}`}
              </div>
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

      {/* Lower sections: calendar, market overview, announcements */}
      <HomeSections />

      {menuOpen && <MenuSheet isAdmin={user?.role === 'ADMIN'} loggedIn={!!user} onClose={() => setMenuOpen(false)} />}
      {scanOpen && <ScanSheet onClose={() => setScanOpen(false)} />}
        </>
      )}
    </div>
  );
}

function MenuSheet({ isAdmin, loggedIn, onClose }: { isAdmin: boolean; loggedIn: boolean; onClose: () => void }) {
  const items = [
    { href: '/m/settings', label: 'Settings', icon: <IconGear size={18} /> },
    { href: '/m/assets/history', label: 'Transaction history', icon: <IconClock size={18} /> },
    ...(loggedIn ? [] : [{ href: '/m/login', label: 'Log in / Sign up', icon: <IconChevronRight size={18} /> }]),
    ...(isAdmin ? [{ href: '/admin/login', label: 'Admin dashboard', icon: <IconChevronRight size={18} /> }] : []),
  ];
  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div className="h-full w-72 bg-bg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white font-black text-black">C</span>
            <span className="font-bold">CediX</span>
          </div>
          <button onClick={onClose} className="rounded-full bg-panel p-2 text-muted"><IconClose size={15} /></button>
        </div>
        <nav className="mt-6 space-y-1">
          {items.map((it) => (
            <Link key={it.label} href={it.href} onClick={onClose} className="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium active:bg-panel">
              <span className="text-muted">{it.icon}</span>
              {it.label}
            </Link>
          ))}
          <Link href="/" onClick={onClose} className="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium active:bg-panel">
            <span className="text-muted"><IconChevronRight size={18} /></span>
            Desktop site
          </Link>
        </nav>
      </div>
    </div>
  );
}

/** QR scanner using the native BarcodeDetector where supported. */
function ScanSheet({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    async function start() {
      try {
        if (!('BarcodeDetector' in window)) {
          setError('QR scanning is not supported in this browser.');
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const tick = async () => {
          if (stop || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              setResult(codes[0].rawValue);
              return;
            }
          } catch { /* keep scanning */ }
          setTimeout(tick, 400);
        };
        tick();
      } catch {
        setError('Camera access was denied.');
      }
    }
    start();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function openResult() {
    try {
      const url = new URL(result);
      if (url.origin === window.location.origin) {
        router.push(url.pathname);
        onClose();
        return;
      }
    } catch { /* not a URL */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/80" onClick={onClose}>
      <div className="w-full rounded-t-3xl bg-bg p-5 pb-10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Scan QR code</h3>
          <button onClick={onClose} className="rounded-full bg-panel p-2 text-muted"><IconClose size={15} /></button>
        </div>
        {error ? (
          <p className="mt-6 pb-6 text-center text-sm text-muted">{error}</p>
        ) : result ? (
          <div className="mt-4 text-center">
            <p className="num break-all rounded-xl bg-panel p-3 text-sm">{result}</p>
            {result.startsWith(typeof window !== 'undefined' ? window.location.origin : '') && (
              <button onClick={openResult} className="mt-3 w-full rounded-full bg-white py-3 font-bold text-black">
                Open
              </button>
            )}
          </div>
        ) : (
          <video ref={videoRef} className="mt-4 aspect-square w-full rounded-2xl bg-black object-cover" muted playsInline />
        )}
      </div>
    </div>
  );
}
