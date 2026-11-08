'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usePoll } from '@/lib/hooks';
import { fmtPrice } from '@/lib/format';
import { IconChevronRight } from '@/components/icons';

type Calendar = {
  available: boolean;
  days: { date: string; weekday: string; items: { symbol: string; name: string }[] }[];
  highlight: { event: string; country: string; date: string } | null;
};
type OverviewCard = { symbol: string; name: string; price: number; changePct: number; spark: number[] };
type Announcement = { id: string; title: string; body: string | null; pinned: boolean; publishAt: string };

/** Lower home-page sections: Trading calendar, Market overview, Announcements. */
export default function HomeSections() {
  return (
    <>
      <CalendarSection />
      <OverviewSection />
      <AnnouncementsSection />
    </>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between pt-7">
      <h2 className="text-[17px] font-bold">{title}</h2>
      <IconChevronRight size={16} className="text-muted" />
    </div>
  );
}

/**
 * Tickers whose generic logo CDN entry is stale (ticker reassigned to a new
 * company). Maps to a verified correct logo URL.
 */
const LOGO_OVERRIDES: Record<string, string> = {
  // FLY now belongs to Firefly Aerospace; Parqet/FMP still serve old Fly Leasing.
  FLY: 'https://s3-symbol-logo.tradingview.com/firefly-aerospace--big.svg',
};

/** Real company logo by ticker (Parqet CDN), with a monogram fallback. */
function CompanyLogo({ symbol, size = 20 }: { symbol: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const clean = symbol.split('.')[0].split('^')[0]; // PBR.A -> PBR
  const override = LOGO_OVERRIDES[clean];
  if (failed) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-foreground font-bold text-background"
        style={{ width: size, height: size, fontSize: size * 0.38 }}
      >
        {clean.slice(0, 2)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={override ?? `https://assets.parqet.com/logos/symbol/${encodeURIComponent(clean)}?format=png&size=64`}
      alt={symbol}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full bg-panel2 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

function CalendarSection() {
  const { data } = usePoll<Calendar>('/api/calendar', 0);

  return (
    <section>
      <SectionHeading title="Trading calendar" />
      {!data ? (
        <div className="mt-3 h-24 animate-pulse rounded-2xl bg-panel" />
      ) : !data.available ? (
        <div className="mt-3 rounded-2xl bg-panel p-4 text-[12.5px] text-muted">
          Calendar data is currently unavailable. Please check back later.
        </div>
      ) : (
        <>
          {data.days.length > 0 && (
            <div className="no-scrollbar -mx-4 mt-3 flex gap-2.5 overflow-x-auto px-4">
              {data.days.map((d) => (
                <div key={d.date} className="min-w-[128px] shrink-0 rounded-2xl bg-panel p-3.5">
                  <div className="text-[13px]">
                    <span className="font-bold">{d.date}</span>{' '}
                    <span className="text-muted">{d.weekday}</span>
                  </div>
                  <div className="mt-2.5 space-y-2">
                    {d.items.map((it) => (
                      <div key={it.symbol} className="flex items-center gap-1.5" title={it.name}>
                        <CompanyLogo symbol={it.symbol} />
                        <span className="text-[13px] font-semibold">{it.symbol}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {data.highlight && (
            <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-panel px-3.5 py-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[8px] font-bold text-background">
                {data.highlight.country === 'U.S.' ? 'US' : data.highlight.country.slice(0, 2).toUpperCase()}
              </span>
              <span className="truncate text-[12.5px]">
                {data.highlight.event} ({data.highlight.country}) is scheduled for{' '}
                {new Date(data.highlight.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
              </span>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return null;
  const w = 128;
  const h = 48;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - 4 - ((v - min) / range) * (h - 8),
  ]);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const color = up ? 'var(--c-up)' : 'var(--c-down)';
  const gid = `sg-${up ? 'u' : 'd'}`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function OverviewSection() {
  const { data } = usePoll<{ available: boolean; cards: OverviewCard[] }>('/api/market-overview', 10 * 60 * 1000);

  return (
    <section>
      <SectionHeading title="Market overview" />
      {!data ? (
        <div className="mt-3 h-36 animate-pulse rounded-2xl bg-panel" />
      ) : !data.available ? (
        <div className="mt-3 rounded-2xl bg-panel p-4 text-[12.5px] text-muted">
          Market overview data is currently unavailable.
        </div>
      ) : (
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2.5 overflow-x-auto px-4">
          {data.cards.map((c) => {
            const up = c.changePct >= 0;
            return (
              <div key={c.symbol} className="min-w-[142px] shrink-0 overflow-hidden rounded-2xl bg-panel">
                <div className="px-3.5 pt-3">
                  <div className="text-[13px] font-semibold">{c.name}</div>
                  <div className={`num mt-1 text-[15px] font-bold ${up ? 'text-up' : 'text-down'}`}>
                    {fmtPrice(c.price, 2)}
                  </div>
                  <div className={`num text-[11px] font-medium ${up ? 'text-up' : 'text-down'}`}>
                    {up ? '+' : ''}{c.changePct.toFixed(2)}%
                  </div>
                </div>
                <div className="mt-1">
                  <Sparkline data={c.spark} up={up} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-1.5 px-1 text-[10.5px] text-muted">Market information only — not tradable on CediX.</p>
    </section>
  );
}

function AnnouncementsSection() {
  const { data } = usePoll<{ announcements: Announcement[] }>('/api/announcements?limit=3', 0);
  const items = data?.announcements ?? [];

  return (
    <section className="pb-2">
      <div className="pt-7">
        <h2 className="text-[17px] font-bold">Announcements</h2>
      </div>
      <div className="mt-1">
        {items.map((a) => (
          <Link key={a.id} href="/m/announcements" className="block py-3 active:opacity-70">
            <div className="text-[14px] font-semibold leading-snug">{a.title}</div>
            <div className="num mt-1 text-[11.5px] text-muted">
              {new Date(a.publishAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })},{' '}
              {new Date(a.publishAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
          </Link>
        ))}
        {data && items.length === 0 && (
          <div className="py-6 text-[12.5px] text-muted">No announcements yet.</div>
        )}
      </div>
      <Link
        href="/m/announcements"
        className="mt-2 block w-full rounded-full bg-panel py-3 text-center text-[13.5px] font-semibold active:opacity-80"
      >
        View more
      </Link>
    </section>
  );
}
