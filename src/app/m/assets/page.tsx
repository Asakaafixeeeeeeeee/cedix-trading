'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { post, usePoll, useUser } from '@/lib/hooks';
import { useDisplayPrefs } from '@/lib/prefs';
import { fmtNum } from '@/lib/format';
import type { Portfolio } from '@/lib/wallet';
import CoinIcon from '@/components/CoinIcon';
import {
  IconEye, IconEyeOff, IconGear, IconClock, IconChevronDown, IconChevronRight,
  IconDeposit, IconWithdraw, IconTransfer, IconEarn, IconWallet, IconCandles, IconP2P, IconClose,
} from '@/components/icons';

const ASSET_NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', BNB: 'BNB', XRP: 'XRP', ADA: 'Cardano',
  DOGE: 'Dogecoin', DOT: 'Polkadot', MATIC: 'Polygon', LTC: 'Litecoin', AVAX: 'Avalanche',
  LINK: 'Chainlink', TRX: 'TRON', SHIB: 'Shiba Inu', USDT: 'Tether', USDC: 'USD Coin',
  GHS: 'Ghanaian Cedi', SUI: 'Sui', SEI: 'Sei', JUP: 'Jupiter', WIF: 'dogwifhat',
  ARB: 'Arbitrum', OP: 'Optimism',
};

type ProductLite = { asset: string; apy: string; type: string };
type PositionLite = {
  id: string; amount: string; accrued: string; status: string;
  product: { name: string; asset: string; apy: string };
};

export default function MobileAssets() {
  const { user, loading } = useUser();
  const { currency, setCurrency, rate, money } = useDisplayPrefs();
  const { data } = usePoll<Portfolio>(user ? '/api/portfolio' : null, 10000);
  const { data: productData } = usePoll<{ products: ProductLite[] }>('/api/earn/products', 0);
  const { data: posData } = usePoll<{ positions: PositionLite[] }>(user ? '/api/earn/positions' : null, 30000);
  const [hidden, setHidden] = useState(false);
  const [showCurrency, setShowCurrency] = useState(false);
  const [bucket, setBucket] = useState<'funding' | 'trading' | 'earn' | null>(null);

  const aprByAsset = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of productData?.products ?? []) {
      const apy = Number(p.apy);
      if (!m.has(p.asset) || apy > m.get(p.asset)!) m.set(p.asset, apy);
    }
    return m;
  }, [productData]);

  async function logout() {
    await post('/api/auth/logout');
    window.location.href = '/m';
  }

  if (!loading && !user) {
    return (
      <div className="px-5 pt-28 text-center">
        <h1 className="text-xl font-bold">My Assets</h1>
        <p className="mt-2 text-sm text-muted">Log in to view your portfolio.</p>
        <Link href="/m/login" className="mt-5 inline-block rounded-full bg-white px-10 py-3 font-semibold text-black">
          Log in
        </Link>
      </div>
    );
  }

  const totalUSD = data?.totalUSD ?? 0;
  const displayValue = currency === 'GHS' && rate ? totalUSD * rate : totalUSD;
  const pnl = data?.pnl24hUSD ?? 0;
  const pnlPct = data?.pnl24hPct ?? 0;
  const pnlUp = pnl >= 0;
  const cryptoAssets = (data?.assets ?? []).filter((a) => a.asset !== 'GHS');

  return (
    <div className="px-4 pt-3">
      {/* Top bar */}
      <div className="flex items-center justify-between py-1">
        <div className="flex items-center gap-1.5 text-sm text-muted">
          Est total value
          <button onClick={() => setHidden((v) => !v)} className="p-1 text-muted active:opacity-60" aria-label="Toggle balance visibility">
            {hidden ? <IconEyeOff size={16} /> : <IconEye size={16} />}
          </button>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/m/assets/history" className="rounded-full bg-panel p-2.5 text-foreground" aria-label="History">
            <IconClock size={17} />
          </Link>
          <Link href="/m/settings" className="rounded-full bg-panel p-2.5 text-foreground" aria-label="Settings">
            <IconGear size={17} />
          </Link>
        </div>
      </div>

      {/* Balance */}
      <div className="relative mt-0.5">
        <button onClick={() => setShowCurrency((v) => !v)} className="flex items-end gap-1.5">
          <span className="num text-[30px] font-bold leading-none tracking-tight">
            {hidden ? '******' : displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="mb-0.5 flex items-center gap-0.5 text-[13px] font-semibold text-foreground">
            {currency}
            <IconChevronDown size={14} className="text-muted" />
          </span>
        </button>
        {showCurrency && (
          <div className="absolute left-0 top-12 z-30 w-56 overflow-hidden rounded-2xl border border-line bg-bg shadow-xl">
            {(['USD', 'GHS'] as const).map((c) => (
              <button
                key={c}
                onClick={() => { setCurrency(c); setShowCurrency(false); }}
                className={`flex w-full items-center justify-between px-4 py-3.5 text-sm ${currency === c ? 'font-bold' : 'text-muted'}`}
              >
                <span>{c === 'USD' ? 'USD — US Dollar' : 'GHS — Ghanaian Cedi'}</span>
                {currency === c && <span className="text-up">✓</span>}
              </button>
            ))}
            {rate && (
              <div className="border-t border-line px-4 py-2.5 text-[11px] text-muted">
                Live rate: 1 USD = {rate.toFixed(4)} GHS
              </div>
            )}
          </div>
        )}
      </div>

      {/* Today's PnL */}
      <Link href="/m/assets/history" className="mt-2.5 flex items-center gap-1 text-sm">
        <span className="border-b border-dashed border-line text-muted">Today&apos;s PnL</span>
        <span className={`num font-semibold ${pnlUp ? 'text-up' : 'text-down'}`}>
          {hidden ? '****' : `${pnlUp ? '+' : '-'}${money(Math.abs(pnl))} (${pnlUp ? '+' : ''}${pnlPct.toFixed(2)}%)`}
        </span>
        <IconChevronRight size={13} className="text-muted" />
      </Link>

      {/* Action buttons */}
      <div className="mt-6 flex items-start justify-between px-2">
        {[
          { href: '/m/deposit', label: 'Deposit', icon: <IconDeposit size={22} /> },
          { href: '/m/withdraw', label: 'Withdraw', icon: <IconWithdraw size={22} /> },
          { href: '/m/transfer', label: 'Transfer', icon: <IconTransfer size={22} /> },
          { href: '/m/explore', label: 'Earn', icon: <IconEarn size={22} /> },
        ].map((b) => (
          <Link key={b.label} href={b.href} className="flex w-16 flex-col items-center gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-sm transition active:scale-95">
              {b.icon}
            </span>
            <span className="text-[12px] font-medium">{b.label}</span>
          </Link>
        ))}
      </div>

      {/* P2P banner */}
      <Link href="/m/p2p" className="mt-6 flex items-center gap-4 rounded-2xl bg-panel p-4 active:opacity-80">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold">Trade P2P with GH₵</div>
          <div className="mt-0.5 truncate text-[12px] text-muted">Buy & sell crypto with MoMo — escrow protected</div>
        </div>
        <span className="rounded-xl bg-panel2 p-3 text-foreground"><IconP2P size={26} /></span>
      </Link>

      {/* Portfolio */}
      <div className="mt-7 flex items-center justify-between">
        <h2 className="text-[16px] font-bold">Portfolio</h2>
      </div>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2.5 overflow-x-auto px-4">
        {[
          { id: 'funding' as const, label: 'Funding', value: data?.fundingUSD ?? 0, icon: <IconWallet size={17} /> },
          { id: 'trading' as const, label: 'Trading', value: data?.tradingUSD ?? 0, icon: <IconCandles size={17} /> },
          { id: 'earn' as const, label: 'Earn', value: data?.earnUSD ?? 0, icon: <IconEarn size={17} /> },
        ].map((c) => (
          <button
            key={c.id}
            onClick={() => setBucket(c.id)}
            className="min-w-[124px] shrink-0 rounded-2xl bg-panel p-3.5 text-left transition active:scale-[0.98]"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-bg text-foreground">
              {c.icon}
            </span>
            <div className="mt-2 text-[13px] font-medium text-muted">{c.label}</div>
            <div className="num mt-1 text-[15px] font-bold">{hidden ? '****' : money(c.value)}</div>
          </button>
        ))}
      </div>

      {/* Crypto list */}
      <div className="mt-7">
        <h2 className="text-[16px] font-bold">Crypto</h2>
        <div className="mt-2 flex items-center justify-between text-[12px] text-muted">
          <span>Name/Amount</span>
          <span className="border-b border-dashed border-line">Value/Spot PnL</span>
        </div>
        <div className="mt-1">
          {cryptoAssets.length === 0 && (
            <div className="rounded-2xl bg-panel py-12 text-center text-sm text-muted">
              No crypto yet —{' '}
              <Link href="/m/deposit" className="font-semibold text-accent">make your first deposit</Link>
            </div>
          )}
          {cryptoAssets.map((a) => {
            const apr = aprByAsset.get(a.asset);
            const up = a.pnl24hUSD >= 0;
            return (
              <Link key={a.asset} href={a.asset === 'USDT' || a.asset === 'USDC' ? '/m/deposit' : `/m/trade/${a.asset}USDT`} className="flex items-center gap-3 py-3 active:opacity-70">
                <CoinIcon asset={a.asset} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold">{a.asset}</span>
                    {apr !== undefined && (
                      <span className="rounded bg-up/10 px-1 py-0.5 text-[9.5px] font-semibold text-up">
                        Up to {apr.toFixed(0)}% APR
                      </span>
                    )}
                  </div>
                  <div className="num mt-0.5 text-[12px] text-muted">
                    {hidden ? '****' : fmtNum(a.total)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-[14px] font-semibold">{hidden ? '****' : money(a.valueUSD)}</div>
                  <div className={`num mt-0.5 text-[12px] font-medium ${a.pnl24hUSD === 0 ? 'text-muted' : up ? 'text-up' : 'text-down'}`}>
                    {hidden ? '' : a.pnl24hUSD === 0 ? '—' : `${up ? '+' : '-'}${money(Math.abs(a.pnl24hUSD))}`}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* GHS funding balance row */}
      {(data?.assets ?? []).filter((a) => a.asset === 'GHS').map((a) => (
        <div key="ghs" className="mt-2">
          <h2 className="text-[16px] font-bold">Fiat</h2>
          <Link href="/m/transfer" className="mt-1 flex items-center gap-3 py-3 active:opacity-70">
            <CoinIcon asset="GHS" size={34} />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold">GHS</div>
              <div className="num mt-0.5 text-[12px] text-muted">{hidden ? '****' : fmtNum(a.total, 2)}</div>
            </div>
            <div className="num text-[14px] font-semibold">{hidden ? '****' : money(a.valueUSD)}</div>
          </Link>
        </div>
      ))}

      <button onClick={logout} className="mb-2 mt-8 w-full py-3 text-center text-sm text-muted">
        Log out
      </button>

      {bucket && (
        <BucketSheet
          bucket={bucket}
          data={data}
          positions={(posData?.positions ?? []).filter((p) => p.status === 'ACTIVE')}
          hidden={hidden}
          money={money}
          onClose={() => setBucket(null)}
        />
      )}
    </div>
  );
}

function BucketSheet({ bucket, data, positions, hidden, money, onClose }: {
  bucket: 'funding' | 'trading' | 'earn';
  data: Portfolio | null;
  positions: PositionLite[];
  hidden: boolean;
  money: (usd: number, d?: number) => string;
  onClose: () => void;
}) {
  const title = bucket === 'funding' ? 'Funding' : bucket === 'trading' ? 'Trading' : 'Earn';
  const value = bucket === 'funding' ? data?.fundingUSD : bucket === 'trading' ? data?.tradingUSD : data?.earnUSD;

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/60" onClick={onClose}>
      <div
        className="max-h-[75vh] w-full overflow-y-auto rounded-t-3xl bg-bg p-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-full bg-panel p-2 text-muted"><IconClose size={16} /></button>
        </div>
        <div className="num mt-1 text-2xl font-bold">{hidden ? '****' : money(value ?? 0)}</div>

        <div className="mt-4 space-y-1">
          {bucket === 'funding' && (
            <>
              {(data?.assets ?? []).filter((a) => a.asset === 'GHS').map((a) => (
                <Row key="ghs" asset="GHS" name="Ghanaian Cedi" sub={`${fmtNum(a.total, 2)} GHS`} right={hidden ? '****' : money(a.valueUSD)} />
              ))}
              {(data?.fundingUSD ?? 0) === 0 && <Empty text="Your GH₵ funding wallet is empty." link="/m/deposit" linkText="Deposit GH₵" />}
              <p className="pt-3 text-[12px] leading-relaxed text-muted">
                The Funding wallet holds your Ghanaian Cedi balance from deposits and P2P trades. Use Transfer to move it into USDT for trading.
              </p>
            </>
          )}
          {bucket === 'trading' && (
            <>
              {(data?.assets ?? []).filter((a) => a.asset !== 'GHS').map((a) => (
                <Row
                  key={a.asset}
                  asset={a.asset}
                  name={ASSET_NAMES[a.asset] ?? a.asset}
                  sub={`${fmtNum(a.available)} available${a.locked > 0 ? ` · ${fmtNum(a.locked)} in orders` : ''}`}
                  right={hidden ? '****' : money(a.valueUSD)}
                />
              ))}
              {(data?.tradingUSD ?? 0) === 0 && <Empty text="No trading assets yet." link="/m/deposit" linkText="Deposit" />}
            </>
          )}
          {bucket === 'earn' && (
            <>
              {positions.map((p) => (
                <Row
                  key={p.id}
                  asset={p.product.asset}
                  name={p.product.name}
                  sub={`${fmtNum(Number(p.amount))} ${p.product.asset} · +${Number(p.accrued).toFixed(6)} earned`}
                  rightNode={<span className="num text-sm font-semibold text-up">{Number(p.product.apy).toFixed(2)}% APY</span>}
                />
              ))}
              {positions.length === 0 && <Empty text="No active earn positions." link="/m/explore" linkText="Explore Earn products" />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ asset, name, sub, right, rightNode }: { asset: string; name: string; sub: string; right?: string; rightNode?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <CoinIcon asset={asset} size={36} />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold">{name}</div>
        <div className="num text-[12px] text-muted">{sub}</div>
      </div>
      {rightNode ?? <div className="num text-[15px] font-bold">{right}</div>}
    </div>
  );
}

function Empty({ text, link, linkText }: { text: string; link: string; linkText: string }) {
  return (
    <div className="rounded-2xl bg-panel py-8 text-center text-sm text-muted">
      {text}{' '}
      <Link href={link} className="font-semibold text-accent">{linkText}</Link>
    </div>
  );
}
