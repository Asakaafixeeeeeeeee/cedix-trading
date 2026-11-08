'use client';
import { useState } from 'react';

// Assets with downloaded official logos in /public/crypto
const SVG = new Set(['btc','eth','sol','bnb','xrp','ada','doge','dot','matic','ltc','avax','link','trx','shib','op','usdt','usdc']);
const PNG = new Set(['sui','sei','jup','wif','arb']);

/** Official cryptocurrency logo with graceful fallback. */
export default function CoinIcon({ asset, size = 32, className = '' }: { asset: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const key = asset.toLowerCase();
  const src = SVG.has(key) ? `/crypto/${key}.svg` : PNG.has(key) ? `/crypto/${key}.png` : null;

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

  if (!src || failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-panel2 font-bold text-muted ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.3 }}
      >
        {asset.slice(0, 3).toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={asset}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
