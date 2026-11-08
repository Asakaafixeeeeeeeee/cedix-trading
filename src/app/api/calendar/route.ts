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

// Popular/trending tickers prioritized in the calendar (the names traders watch),
// matching the selection style of major exchanges. Earnings dates remain 100% real.
const WATCHLIST = new Set([
  'RKLB','ASTS','CRWV','FLY','NBIS','CBRS','PLTR','COIN','HOOD','SOFI','MSTR','SMCI','ARM','IONQ','JOBY','ACHR',
  'OKLO','SMR','RBLX','U','PATH','UPST','AFRM','DKNG','ROKU','NET','DDOG','SNOW','SHOP','SPOT','UBER','ABNB',
  'AMD','NVDA','TSLA','AAPL','MSFT','AMZN','GOOGL','GOOG','META','NFLX','AVGO','INTC','MU','QCOM','ORCL','CRM',
  'DIS','BA','PYPL','XYZ','SQ','GME','AMC','RIVN','LCID','NIO','LI','XPEV','BABA','JD','PDD','SE','GRAB','CVNA',
  'CELH','ELF','DUOL','APP','TTD','ZS','CRWD','PANW','MDB','OSCR','RDDT','DJT','TEM','LUNR','RGTI','QBTS','BBAI',
]);

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
  const rows = (json?.data?.rows ?? []) as { symbol: string; name: string; marketCap: string; noOfEsts?: string }[];
  const mapped = rows.map((r) => ({
    symbol: r.symbol,
    name: r.name,
    cap: Number(String(r.marketCap).replace(/[^0-9]/g, '')) || 0,
    hot: WATCHLIST.has(r.symbol.split('.')[0]),
  }));
  // trending watchlist names first, then by size; dedupe share classes (PBR / PBR.A)
  mapped.sort((a, b) => (Number(b.hot) - Number(a.hot)) || b.cap - a.cap);
  const seen = new Set<string>();
  const out: { symbol: string; name: string }[] = [];
  for (const r of mapped) {
    const root = r.symbol.split('.')[0];
    if (seen.has(root)) continue;
    seen.add(root);
    out.push({ symbol: r.symbol, name: r.name });
    if (out.length === 2) break;
  }
  return out;
}

async function fetchEconHighlight(dates: string[]) {
  // Collect events across all days, then pick the strongest:
  // U.S. inflation/rates/jobs first, then other U.S. majors, then foreign majors.
  type Candidate = { event: string; country: string; date: string; score: number };
  const inflation = /core inflation|inflation rate|\bcpi\b/i;
  const strong = /interest rate decision|fomc minutes|fomc statement|non.?farm|payrolls?\b/i;
  const medium = /gdp\b|unemployment rate|\bppi\b|retail sales|consumer confidence/i;
  const candidates: Candidate[] = [];

  await Promise.all(
    dates.map(async (date) => {
      try {
        const res = await fetch(`https://api.nasdaq.com/api/calendar/economicevents?date=${date}`, {
          headers: HEADERS,
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return;
        const json = await res.json();
        const rows = (json?.data?.rows ?? []) as { country: string; eventName: string }[];
        for (const r of rows) {
          const name = r.eventName.trim();
          const isUS = r.country === 'United States';
          let score = 0;
          if (isUS && inflation.test(name)) score = 6;
          else if (isUS && strong.test(name)) score = 5;
          else if (isUS && medium.test(name)) score = 4;
          else if (inflation.test(name) || strong.test(name)) score = 2;
          else if (isUS) score = 1;
          // prefer actual data releases over speeches/testimony
          if (/speaks|speech|testif|remarks/i.test(name)) score -= 2;
          if (score > 0) candidates.push({ event: name, country: isUS ? 'U.S.' : r.country, date, score });
        }
      } catch {
        /* skip date */
      }
    }),
  );

  candidates.sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
  return candidates[0] ?? null;
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
