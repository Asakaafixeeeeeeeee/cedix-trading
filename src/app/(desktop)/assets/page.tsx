'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { usePoll, useUser } from '@/lib/hooks';
import { useDisplayPrefs } from '@/lib/prefs';
import { fmtNum, timeAgo } from '@/lib/format';
import type { Portfolio } from '@/lib/wallet';
import CoinIcon from '@/components/CoinIcon';
import {
  IconEye, IconEyeOff, IconChevronDown, IconDeposit, IconWithdraw, IconTransfer, IconEarn,
  IconWallet, IconCandles,
} from '@/components/icons';

type Tx = {
  id: string;
  type: string;
  status: string;
  asset: string;
  amount: string;
  fee: string;
  note: string | null;
  createdAt: string;
};

type ProductLite = { asset: string; apy: string; type: string };

const TX_COLORS: Record<string, string> = {
  DEPOSIT: 'text-up', TRADE_BUY: 'text-up', P2P_BUY: 'text-up', EARN_INTEREST: 'text-gold',
  WITHDRAWAL: 'text-down', TRADE_SELL: 'text-down', P2P_SELL: 'text-down',
};

const ASSET_NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', BNB: 'BNB', XRP: 'XRP', ADA: 'Cardano',
  DOGE: 'Dogecoin', DOT: 'Polkadot', MATIC: 'Polygon', LTC: 'Litecoin', AVAX: 'Avalanche',
  LINK: 'Chainlink', TRX: 'TRON', SHIB: 'Shiba Inu', USDT: 'Tether', USDC: 'USD Coin', GHS: 'Ghanaian Cedi',
};

export default function AssetsPage() {
  const { user, loading } = useUser();
  const { currency, setCurrency, rate, money } = useDisplayPrefs();
  const { data } = usePoll<Portfolio>(user ? '/api/portfolio' : null, 10000);
  const { data: txData } = usePoll<{ transactions: Tx[] }>(user ? '/api/transactions' : null, 15000);
  const { data: productData } = usePoll<{ products: ProductLite[] }>('/api/earn/products', 0);
  const [hidden, setHidden] = useState(false);
  const [showCurrency, setShowCurrency] = useState(false);

  const aprByAsset = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of productData?.products ?? []) {
      const apy = Number(p.apy);
      if (!m.has(p.asset) || apy > m.get(p.asset)!) m.set(p.asset, apy);
    }
    return m;
  }, [productData]);

  if (!loading && !user) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-2xl font-bold">My Assets</h1>
        <p className="mt-2 text-muted">Log in to view your portfolio.</p>
        <Link href="/login" className="mt-4 inline-block rounded-full bg-white px-8 py-2.5 font-semibold text-black">Log in</Link>
      </div>
    );
  }

  const totalUSD = data?.totalUSD ?? 0;
  const displayValue = currency === 'GHS' && rate ? totalUSD * rate : totalUSD;
  const pnl = data?.pnl24hUSD ?? 0;
  const pnlUp = pnl >= 0;
  const cryptoAssets = (data?.assets ?? []).filter((a) => a.asset !== 'GHS');
  const fiatAssets = (data?.assets ?? []).filter((a) => a.asset === 'GHS');

  return (
    <div className="mx-auto max-w-4xl pt-8">
      {/* Est total value */}
      <div className="flex items-center gap-2 text-sm text-muted">
        Est. Total Value
        <button onClick={() => setHidden((v) => !v)} className="p-1 hover:text-foreground" aria-label="Toggle visibility">
          {hidden ? <IconEyeOff size={16} /> : <IconEye size={16} />}
        </button>
      </div>
      <div className="relative mt-1 flex items-end gap-6">
        <button onClick={() => setShowCurrency((v) => !v)} className="flex items-end gap-2">
          <span className="num text-5xl font-bold tracking-tight">
            {hidden ? '******' : displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="mb-1.5 flex items-center gap-1 text-lg font-semibold">
            {currency} <IconChevronDown size={15} className="text-muted" />
          </span>
        </button>
        {showCurrency && (
          <div className="absolute left-0 top-16 z-30 w-64 overflow-hidden rounded-2xl border border-line bg-bg shadow-xl">
            {(['USD', 'GHS'] as const).map((c) => (
              <button
                key={c}
                onClick={() => { setCurrency(c); setShowCurrency(false); }}
                className={`flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-panel ${currency === c ? 'font-bold' : 'text-muted'}`}
              >
                {c === 'USD' ? 'USD — US Dollar (default)' : 'GHS — Ghanaian Cedi'}
                {currency === c && <span className="text-up">✓</span>}
              </button>
            ))}
            {rate && <div className="border-t border-line px-4 py-2 text-[11px] text-muted">Live rate: 1 USD = {rate.toFixed(4)} GHS</div>}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-sm">
        <span className="border-b border-dashed border-line text-muted">Today&apos;s PnL</span>
        <span className={`num font-semibold ${pnlUp ? 'text-up' : 'text-down'}`}>
          {hidden ? '****' : `${pnlUp ? '+' : '-'}${money(Math.abs(pnl))} (${pnlUp ? '+' : ''}${(data?.pnl24hPct ?? 0).toFixed(2)}%)`}
        </span>
      </div>

      {/* Action buttons */}
      <div className="mt-8 flex gap-8">
        {[
          { href: '/deposit', label: 'Deposit', icon: <IconDeposit size={22} /> },
          { href: '/withdraw', label: 'Withdraw', icon: <IconWithdraw size={22} /> },
          { href: '/m/transfer', label: 'Transfer', icon: <IconTransfer size={22} /> },
          { href: '/explore', label: 'Earn', icon: <IconEarn size={22} /> },
        ].map((b) => (
          <Link key={b.label} href={b.href} className="group flex flex-col items-center gap-2">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-sm transition group-hover:scale-105">
              {b.icon}
            </span>
            <span className="text-sm font-medium">{b.label}</span>
          </Link>
        ))}
      </div>

      {/* Portfolio */}
      <h2 className="mt-10 text-xl font-bold">Portfolio</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Funding', value: data?.fundingUSD ?? 0, icon: <IconWallet size={18} />, sub: 'GH₵ fiat wallet', href: '/m/transfer' },
          { label: 'Trading', value: data?.tradingUSD ?? 0, icon: <IconCandles size={18} />, sub: 'Spot wallet', href: '/trade/BTCUSDT' },
          { label: 'Earn', value: data?.earnUSD ?? 0, icon: <IconEarn size={18} />, sub: 'Staking & savings', href: '/explore' },
        ].map((c) => (
          <Link key={c.label} href={c.href} className="rounded-2xl bg-panel p-5 ring-1 ring-line transition hover:ring-accent">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-bg">{c.icon}</span>
            <div className="mt-3 font-semibold text-muted">{c.label}</div>
            <div className="num mt-1 text-xl font-bold">{hidden ? '****' : money(c.value)}</div>
            <div className="mt-0.5 text-xs text-muted">{c.sub}</div>
          </Link>
        ))}
      </div>

      {/* Crypto */}
      <h2 className="mt-10 text-xl font-bold">Crypto</h2>
      <div className="mt-3 overflow-hidden rounded-2xl bg-panel ring-1 ring-line">
        <div className="flex items-center justify-between px-5 py-3 text-xs text-muted">
          <span>Name / Amount</span>
          <span>Value / Spot PnL</span>
        </div>
        {cryptoAssets.length === 0 && (
          <div className="px-5 py-14 text-center text-sm text-muted">
            No crypto yet — <Link href="/deposit" className="font-semibold text-accent">make your first deposit</Link>.
          </div>
        )}
        {cryptoAssets.map((a) => {
          const apr = aprByAsset.get(a.asset);
          const up = a.pnl24hUSD >= 0;
          return (
            <Link
              key={a.asset}
              href={a.asset === 'USDT' || a.asset === 'USDC' ? '/deposit' : `/trade/${a.asset}USDT`}
              className="flex items-center gap-4 border-t border-line/60 px-5 py-4 transition hover:bg-panel2/50"
            >
              <CoinIcon asset={a.asset} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{ASSET_NAMES[a.asset] ?? a.asset}</span>
                  <span className="text-sm text-muted">{a.asset}</span>
                  {apr !== undefined && (
                    <span className="rounded-md bg-up/10 px-1.5 py-0.5 text-[10px] font-semibold text-up">Up to {apr.toFixed(0)}% APR</span>
                  )}
                </div>
                <div className="num mt-0.5 text-sm text-muted">
                  {hidden ? '****' : `${fmtNum(a.total)} ${a.asset}`}
                  {a.locked > 0 && !hidden && <span className="ml-2 text-xs">({fmtNum(a.locked)} in orders)</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="num font-bold">{hidden ? '****' : money(a.valueUSD)}</div>
                <div className={`num mt-0.5 text-xs font-medium ${a.pnl24hUSD === 0 ? 'text-muted' : up ? 'text-up' : 'text-down'}`}>
                  {hidden ? '' : a.pnl24hUSD === 0 ? '—' : `${up ? '+' : '-'}${money(Math.abs(a.pnl24hUSD))} today`}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Fiat */}
      {fiatAssets.length > 0 && (
        <>
          <h2 className="mt-8 text-xl font-bold">Fiat</h2>
          <div className="mt-3 overflow-hidden rounded-2xl bg-panel ring-1 ring-line">
            {fiatAssets.map((a) => (
              <Link key={a.asset} href="/m/transfer" className="flex items-center gap-4 px-5 py-4 transition hover:bg-panel2/50">
                <CoinIcon asset="GHS" size={40} />
                <div className="min-w-0 flex-1">
                  <div className="font-bold">Ghanaian Cedi <span className="text-sm font-normal text-muted">GHS</span></div>
                  <div className="num mt-0.5 text-sm text-muted">{hidden ? '****' : `${fmtNum(a.total, 2)} GHS`}</div>
                </div>
                <div className="num font-bold">{hidden ? '****' : money(a.valueUSD)}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* History */}
      <h2 className="mt-10 text-xl font-bold">Transaction History</h2>
      <div className="mb-10 mt-3 overflow-hidden rounded-2xl bg-panel ring-1 ring-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-3 pl-5 font-medium">Time</th>
              <th className="font-medium">Type</th>
              <th className="font-medium">Asset</th>
              <th className="font-medium">Amount</th>
              <th className="hidden font-medium lg:table-cell">Details</th>
              <th className="pr-5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(txData?.transactions ?? []).length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-muted">No transactions yet.</td></tr>
            )}
            {(txData?.transactions ?? []).map((t) => (
              <tr key={t.id} className="border-t border-line/60">
                <td className="py-3 pl-5 text-xs text-muted">{timeAgo(t.createdAt)}</td>
                <td className={`text-xs font-semibold ${TX_COLORS[t.type] ?? ''}`}>{t.type.replace(/_/g, ' ')}</td>
                <td className="font-medium">{t.asset}</td>
                <td className="num">{fmtNum(Number(t.amount))}</td>
                <td className="hidden max-w-md truncate text-xs text-muted lg:table-cell">{t.note}</td>
                <td className={`pr-5 text-xs ${t.status === 'COMPLETED' ? 'text-up' : t.status === 'FAILED' ? 'text-down' : 'text-gold'}`}>
                  {t.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
