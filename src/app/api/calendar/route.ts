import { api } from '@/lib/api';

// Trading calendar backed by Nasdaq's public calendar API (real earnings and
// economic events). Cached for 30 minutes. When the feed is unreachable the
// response reports available:false and the UI shows an unavailable message.

type Day = { date: string; weekday: string; items: { symbol: string; name: string }[] };
type Calendar = {
  available: boolean;
  days: Day[];
  highlight: { event: string; country: string; date: string } | null;
};

let cache: { data: Calendar; at: number } | null = null;
const TTL = 30 * 60 * 1000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  Accept: 'application/json',
};

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function fetchEarnings(date: string) {
  const res = await fetch(`https://api.nasdaq.com/api/calendar/earnings?date=${date}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const json = await res.json();
  const rows = (json?.data?.rows ?? []) as { symbol: string; name: string; marketCap: string }[];
  // largest companies first (marketCap like "$1,234,000"), dedupe share classes (PBR / PBR.A)
  const sorted = rows
    .map((r) => ({ symbol: r.symbol, name: r.name, cap: Number(String(r.marketCap).replace(/[^0-9]/g, '')) || 0 }))
    .sort((a, b) => b.cap - a.cap);
  const seen = new Set<string>();
  const out: { symbol: string; name: string }[] = [];
  for (const r of sorted) {
    const root = r.symbol.split('.')[0];
    if (seen.has(root)) continue;
    seen.add(root);
    out.push({ symbol: r.symbol, name: r.name });
    if (out.length === 2) break;
  }
  return out;
}

async function fetchEconHighlight(dates: string[]) {
  for (const date of dates) {
    try {
      const res = await fetch(`https://api.nasdaq.com/api/calendar/economicevents?date=${date}`, {
        headers: HEADERS,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const rows = (json?.data?.rows ?? []) as { country: string; eventName: string }[];
      const keywords = /inflation|cpi|interest rate|fed|fomc|gdp|unemployment|non.?farm|payroll/i;
      const major =
        rows.find((r) => r.country === 'United States' && keywords.test(r.eventName)) ??
        rows.find((r) => keywords.test(r.eventName)) ??
        rows.find((r) => r.country === 'United States');
      if (major) {
        return { event: major.eventName.trim(), country: major.country, date };
      }
    } catch {
      /* try next date */
    }
  }
  return null;
}

export async function GET() {
  return api(async (): Promise<Calendar> => {
    if (cache && Date.now() - cache.at < TTL) return cache.data;

    try {
      // next 7 days → keep the first 4 days that have earnings
      const dates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(Date.now() + i * 86400000);
        const dow = d.getUTCDay();
        if (dow === 0 || dow === 6) continue; // markets closed
        dates.push(fmtDate(d));
      }

      const results = await Promise.all(dates.slice(0, 5).map(async (date) => ({ date, items: await fetchEarnings(date) })));
      const days: Day[] = results
        .filter((r) => r.items.length > 0)
        .slice(0, 4)
        .map((r) => {
          const d = new Date(r.date + 'T00:00:00Z');
          return {
            date: `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`,
            weekday: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
            items: r.items,
          };
        });

      const highlight = await fetchEconHighlight(dates.slice(0, 4));

      const data: Calendar = { available: days.length > 0 || highlight !== null, days, highlight };
      if (data.available) cache = { data, at: Date.now() };
      return data;
    } catch {
      return cache?.data ?? { available: false, days: [], highlight: null };
    }
  });
}
