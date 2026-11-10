'use client';
import { useEffect, useState } from 'react';
import { usePoll } from '@/lib/hooks';
import { fmtNum } from '@/lib/format';

type MarketRow = { symbol: string; base: string; price: number; changePct: number };

/**
 * DEMO / PRACTICE MODE — a virtual trading simulator for admins.
 *
 * This panel NEVER touches real market prices, real customer balances or
 * real-money trading results. It computes the outcome of a hypothetical
 * investment using virtual funds only, so you can demonstrate how a trade
 * gains or loses value. Nothing here is written to the database.
 */
export default function AdminTrading() {
  const { data } = usePoll<{ markets: MarketRow[] }>('/api/markets?type=spot', 8000);
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [stake, setStake] = useState('100');
  const [scenario, setScenario] = useState<'normal' | 'win' | 'lose' | 'custom'>('normal');
  const [customPct, setCustomPct] = useState('5');

  const market = data?.markets.find((m) => m.symbol === symbol);
  const entry = market?.price ?? 0;
  const stakeUSD = parseFloat(stake) || 0;

  // Virtual move applied to the entry price — purely illustrative.
  let movePct = 0;
  if (scenario === 'normal') movePct = market?.changePct ?? 0; // today's real market move, for realism only
  else if (scenario === 'win') movePct = 8;
  else if (scenario === 'lose') movePct = -8;
  else movePct = parseFloat(customPct) || 0;

  const exit = entry * (1 + movePct / 100);
  const qty = entry > 0 ? stakeUSD / entry : 0;
  const pnl = qty * (exit - entry);
  const finalValue = stakeUSD + pnl;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-500">Demo / Practice</span>
          <h3 className="font-bold">Virtual trading simulator</h3>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Virtual funds only. This simulator never affects real market prices, real customer balances, or real-money
          trades. Use it to demonstrate how an investment can gain or lose value. Nothing here is saved.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Controls */}
        <div className="space-y-4 rounded-xl border border-line bg-panel p-4">
          <label className="block">
            <span className="text-xs font-medium text-muted">Market</span>
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm">
              {(data?.markets ?? []).filter((m) => m.symbol.endsWith('USDT')).slice(0, 50).map((m) => (
                <option key={m.symbol} value={m.symbol}>{m.base}/USD — {fmtNum(m.price, 2)}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted">Virtual investment (USD)</span>
            <input value={stake} onChange={(e) => setStake(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className="num mt-1 w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm" />
          </label>

          <div>
            <span className="text-xs font-medium text-muted">Scenario</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {([
                ['normal', 'Normal market'],
                ['win', 'Winning demo'],
                ['lose', 'Losing demo'],
                ['custom', 'Custom move'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setScenario(id)}
                  className={`rounded-lg border px-3 py-2 text-xs font-bold ${scenario === id ? 'border-accent bg-panel2' : 'border-line text-muted'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {scenario === 'custom' && (
            <label className="block">
              <span className="text-xs font-medium text-muted">Custom price movement (%)</span>
              <input value={customPct} onChange={(e) => setCustomPct(e.target.value.replace(/[^\d.-]/g, ''))} inputMode="decimal" className="num mt-1 w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm" />
            </label>
          )}
        </div>

        {/* Outcome */}
        <div className="space-y-3 rounded-xl border border-line bg-panel p-4">
          <h4 className="font-bold">Simulated outcome</h4>
          <Row k="Entry price" v={`$${fmtNum(entry, 2)}`} />
          <Row k="Price movement" v={`${movePct >= 0 ? '+' : ''}${fmtNum(movePct, 2)}%`} tone={movePct >= 0 ? 'up' : 'down'} />
          <Row k="Exit price" v={`$${fmtNum(exit, 2)}`} />
          <Row k="Quantity" v={`${fmtNum(qty, 6)}`} />
          <Row k="Profit / Loss" v={`${pnl >= 0 ? '+' : ''}$${fmtNum(pnl, 2)}`} tone={pnl >= 0 ? 'up' : 'down'} />
          <div className="flex items-center justify-between border-t border-line pt-2">
            <span className="text-sm font-bold">Final virtual value</span>
            <span className={`num text-lg font-extrabold ${finalValue >= stakeUSD ? 'text-up' : 'text-down'}`}>${fmtNum(finalValue, 2)}</span>
          </div>
          <p className="text-[11px] text-muted">Based on a live entry price with a virtual {scenario === 'normal' ? "move equal to today's real market change" : 'illustrative move'}. Not a prediction and not real money.</p>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: 'up' | 'down' }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{k}</span>
      <span className={`num font-semibold ${tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : ''}`}>{v}</span>
    </div>
  );
}
