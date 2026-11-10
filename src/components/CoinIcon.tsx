'use client';
import { useState } from 'react';

// Official logos downloaded into /public/crypto (highest quality, same-origin).
const LOCAL_SVG = new Set(['btc', 'eth', 'sol', 'bnb', 'xrp', 'ada', 'doge', 'dot', 'matic', 'ltc', 'avax', 'link', 'trx', 'shib', 'op', 'usdt', 'usdc']);
const LOCAL_PNG = new Set(['sui', 'sei', 'jup', 'wif', 'arb']);

// Map our ticker → the slug used by the cryptocurrency-icons CDN set.
const CDN_ALIAS: Record<string, string> = { pol: 'matic', render: 'rndr' };

// Deterministic brand-like colour for the monogram fallback (never grey).
const PALETTE = ['#F7931A', '#627EEA', '#9945FF', '#F3BA2F', '#23292F', '#0033AD', '#C2A633', '#E6007A', '#345D9D', '#E84142', '#2A5ADA', '#EF0027', '#14B6E7', '#FF007A', '#2E3148', '#00C08B', '#0090FF', '#0098EA', '#17EAD9', '#F15A24', '#B6509E', '#1AAB9B', '#6747ED', '#2C7DF7', '#00ADEF'];
function colorFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Official asset logo with CDN fallback and an intentional coloured monogram. */
export default function CoinIcon({ asset, size = 32, className = '' }: { asset: string; size?: number; className?: string }) {
  const key = asset.toLowerCase();

  if (key === 'ghs') {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#CE1126] font-bold text-[#ffffff] ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.44 }}
      >
        ₵
      </span>
    );
  }

  // Ordered source chain: local logo → CDN logos → coloured monogram.
  const sources: string[] = [];
  if (LOCAL_SVG.has(key)) sources.push(`/crypto/${key}.svg`);
  if (LOCAL_PNG.has(key)) sources.push(`/crypto/${key}.png`);
  const slug = CDN_ALIAS[key] ?? key;
  sources.push(`https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${slug}.svg`);
  sources.push(`https://assets.coincap.io/assets/icons/${key}@2x.png`);

  const [idx, setIdx] = useState(0);

  // Exhausted all image sources → intentional coloured monogram (not grey).
  if (idx >= sources.length) {
    const bg = colorFor(key);
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-[#ffffff] ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.38, background: bg }}
      >
        {asset.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sources[idx]}
      alt={asset}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setIdx((i) => i + 1)}
      className={`shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
