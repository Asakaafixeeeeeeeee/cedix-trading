import { prisma } from './db';

export type FxInfo = {
  /** Effective GHS per USD after margin/override */
  rate: number;
  baseRate: number;
  marginPct: number;
  source: 'live' | 'override' | 'fallback';
  updatedAt: number;
};

const FALLBACK_RATE = 15.7; // GHS per USD, used only if the FX API is unreachable
let cache: { baseRate: number; at: number } | null = null;
const TTL = 10 * 60 * 1000;

async function fetchLiveRate(): Promise<number | null> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) return null;
    const data = await res.json();
    const ghs = data?.rates?.GHS;
    return typeof ghs === 'number' && ghs > 0 ? ghs : null;
  } catch {
    return null;
  }
}

async function getSettingNumber(key: string): Promise<number | null> {
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    const v = row?.value;
    return typeof v === 'number' ? v : null;
  } catch {
    return null;
  }
}

/** USD→GHS rate: live API + admin margin, or full admin override. */
export async function getFx(): Promise<FxInfo> {
  const override = await getSettingNumber('fx_override');
  const marginPct = (await getSettingNumber('fx_margin_pct')) ?? 0;

  if (override && override > 0) {
    return { rate: override, baseRate: override, marginPct: 0, source: 'override', updatedAt: Date.now() };
  }

  let baseRate: number;
  let source: FxInfo['source'] = 'live';
  if (cache && Date.now() - cache.at < TTL) {
    baseRate = cache.baseRate;
  } else {
    const live = await fetchLiveRate();
    if (live) {
      cache = { baseRate: live, at: Date.now() };
      baseRate = live;
    } else {
      baseRate = cache?.baseRate ?? FALLBACK_RATE;
      source = cache ? 'live' : 'fallback';
    }
  }

  const rate = baseRate * (1 + marginPct / 100);
  return { rate, baseRate, marginPct, source, updatedAt: cache?.at ?? Date.now() };
}
