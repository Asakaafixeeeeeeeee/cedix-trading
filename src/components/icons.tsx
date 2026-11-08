// Professional SVG icon set for CediX (stroke-based, inherits currentColor).
type P = { size?: number; className?: string; strokeWidth?: number };

function Base({ size = 20, className, strokeWidth = 1.8, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const IconEye = (p: P) => (
  <Base {...p}>
    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Base>
);

export const IconEyeOff = (p: P) => (
  <Base {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.8 17.8 0 0 1-3.2 4.1M6.6 6.6C3.8 8.5 2 12 2 12s3.5 7 10 7c1.5 0 2.9-.3 4.1-.9" />
    <path d="M9.9 9.9a2.8 2.8 0 0 0 4 4" />
  </Base>
);

export const IconDeposit = (p: P) => (
  <Base {...p}>
    <path d="M12 4v10" />
    <path d="m7.5 10.5 4.5 4 4.5-4" />
    <path d="M5 19.5h14" />
  </Base>
);

export const IconWithdraw = (p: P) => (
  <Base {...p}>
    <path d="M12 14V4" />
    <path d="m7.5 7.5 4.5-4 4.5 4" />
    <path d="M5 19.5h14" />
  </Base>
);

export const IconTransfer = (p: P) => (
  <Base {...p}>
    <path d="M4 8.5h13" />
    <path d="m14 4.5 4 4-4 4" />
    <path d="M20 15.5H7" />
    <path d="m10 11.5-4 4 4 4" />
  </Base>
);

export const IconEarn = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v9M9 10.2c0-1.2 1.3-2 3-2s3 .7 3 1.9c0 2.9-6 1.4-6 4.1 0 1.2 1.3 2 3 2s3-.8 3-2" />
  </Base>
);

export const IconGear = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 13.6a1.8 1.8 0 0 0 .4 2l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.7v.2a2 2 0 1 1-4.1 0v-.2a1.8 1.8 0 0 0-1.2-1.6 1.8 1.8 0 0 0-2 .4l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.6-1.1h-.2a2 2 0 1 1 0-4.1h.2A1.8 1.8 0 0 0 4 7.3a1.8 1.8 0 0 0-.4-2l-.1-.1A2 2 0 1 1 6.4 2.3l.1.1a1.8 1.8 0 0 0 2 .4h.1A1.8 1.8 0 0 0 9.7 1.1v-.2a2 2 0 1 1 4.1 0v.2a1.8 1.8 0 0 0 1.1 1.7 1.8 1.8 0 0 0 2-.4l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.8 1.8 0 0 0-.4 2v.1a1.8 1.8 0 0 0 1.7 1.1h.2a2 2 0 1 1 0 4.1h-.2a1.8 1.8 0 0 0-1.7 1.2Z" />
  </Base>
);

export const IconClock = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Base>
);

export const IconChevronRight = (p: P) => (
  <Base {...p}>
    <path d="m9 5 7 7-7 7" />
  </Base>
);

export const IconChevronDown = (p: P) => (
  <Base {...p}>
    <path d="m5 9 7 7 7-7" />
  </Base>
);

export const IconSearch = (p: P) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20.5 20.5-4.5-4.5" />
  </Base>
);

export const IconWallet = (p: P) => (
  <Base {...p}>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5v0H5.5A2.5 2.5 0 0 1 3 7.5Zm0 0V17a2.5 2.5 0 0 0 2.5 2.5h13A2.5 2.5 0 0 0 21 17v-5.5A2.5 2.5 0 0 0 18.5 9H5.5" />
    <circle cx="16.5" cy="14.2" r="1.1" fill="currentColor" stroke="none" />
  </Base>
);

export const IconCandles = (p: P) => (
  <Base {...p}>
    <path d="M7 4v3M7 17v3M7 7h0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h0a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2ZM17 3v2M17 19v2M17 5h0a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h0a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
  </Base>
);

// ── Bottom navigation icons ──
export const IconHome = (p: P) => (
  <Base {...p}>
    <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" />
    <path d="M9.5 20.5v-6h5v6" />
  </Base>
);

export const IconMarkets = (p: P) => (
  <Base {...p}>
    <path d="M4 19.5h16" />
    <path d="M5.5 15.5 10 10l3.2 3.2 5.3-6.2" />
    <path d="M18.5 10.5V7h-3.4" />
  </Base>
);

export const IconTrade = (p: P) => (
  <Base {...p}>
    <path d="M5 9h12" />
    <path d="m13.5 5.5 3.5 3.5-3.5 3.5" />
    <path d="M19 15.5H7" />
    <path d="m10.5 12-3.5 3.5 3.5 3.5" />
  </Base>
);

export const IconOrbit = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="5.2" />
    <path d="M18.6 7.2c2 .9 3.2 2 3.2 3.2 0 2.5-4.4 4.6-9.8 4.6S2.2 12.9 2.2 10.4c0-1.1 1-2.2 2.8-3" />
    <circle cx="18.8" cy="5.4" r="1" fill="currentColor" stroke="none" />
  </Base>
);

export const IconAssets = (p: P) => (
  <Base {...p}>
    <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12V3.5Z" />
    <path d="M15.5 3.9A8.5 8.5 0 0 1 20.1 8.5H15.5V3.9Z" />
  </Base>
);

export const IconMoon = (p: P) => (
  <Base {...p}>
    <path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5Z" />
  </Base>
);

export const IconSun = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </Base>
);

export const IconClose = (p: P) => (
  <Base {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Base>
);

export const IconP2P = (p: P) => (
  <Base {...p}>
    <circle cx="7.5" cy="7" r="2.8" />
    <circle cx="16.5" cy="17" r="2.8" />
    <path d="M13 5.5h4.5a2 2 0 0 1 2 2V10M11 18.5H6.5a2 2 0 0 1-2-2V14" />
    <path d="m17.5 8.5 2 1.5 1.5-2M6.5 15.5l-2-1.5L3 16" />
  </Base>
);

export const IconMenu = (p: P) => (
  <Base {...p} strokeWidth={0}>
    {[5.5, 12, 18.5].flatMap((y) =>
      [5.5, 12, 18.5].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.7" fill="currentColor" />),
    )}
  </Base>
);

export const IconScan = (p: P) => (
  <Base {...p}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
    <path d="M4 12h16" />
  </Base>
);

export const IconShield = (p: P) => (
  <Base {...p}>
    <path d="M12 3 5 5.8v5.4c0 4.4 3 8 7 9.3 4-1.3 7-4.9 7-9.3V5.8L12 3Z" />
    <path d="m9 11.8 2.2 2.2L15.5 9.5" />
  </Base>
);

export const IconIdCard = (p: P) => (
  <Base {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2" />
    <circle cx="8.5" cy="11" r="2" />
    <path d="M5.8 15.8c.5-1.5 1.5-2.3 2.7-2.3s2.2.8 2.7 2.3M14 9.5h4.5M14 12.5h4.5M14 15.5h2.8" />
  </Base>
);

export const IconCamera = (p: P) => (
  <Base {...p}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2.2h6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z" />
    <circle cx="12" cy="12.8" r="3.4" />
  </Base>
);

export const IconCheckCircle = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.3 12.2 2.5 2.5 5-5.2" />
  </Base>
);

export const IconAlertCircle = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8v5M12 16.2v.3" />
  </Base>
);

export const IconUpload = (p: P) => (
  <Base {...p}>
    <path d="M12 15V5M8 8.5 12 4.5l4 4" />
    <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
  </Base>
);

export const IconLock = (p: P) => (
  <Base {...p}>
    <rect x="5.5" y="10.5" width="13" height="9.5" rx="2" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    <circle cx="12" cy="15.2" r="1.2" fill="currentColor" stroke="none" />
  </Base>
);

export const IconMail = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path d="m4.5 7.5 7.5 6 7.5-6" />
  </Base>
);

export const IconFilter = (p: P) => (
  <Base {...p}>
    <path d="M4 6.5h16M7 12h10M10 17.5h4" />
  </Base>
);

export const IconArrowLeft = (p: P) => (
  <Base {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Base>
);

export const IconImage = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="m5 18 5-5 3 3 3.5-3.5L20.5 16" />
  </Base>
);

export const IconVideo = (p: P) => (
  <Base {...p}>
    <rect x="3" y="6.5" width="13" height="11" rx="2" />
    <path d="m16 10.5 5-2.8v8.6l-5-2.8" />
  </Base>
);

export const IconHeart = (p: P & { filled?: boolean }) => (
  <svg width={p.size ?? 20} height={p.size ?? 20} viewBox="0 0 24 24" fill={p.filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden>
    <path d="M12 20.5s-7.5-4.8-9.5-9.3C1.2 8.3 3 5 6.3 5c2 0 3.7 1.1 4.7 2.8l1 1.7 1-1.7C14 6.1 15.7 5 17.7 5 21 5 22.8 8.3 21.5 11.2c-2 4.5-9.5 9.3-9.5 9.3Z" />
  </svg>
);

export const IconComment = (p: P) => (
  <Base {...p}>
    <path d="M20 11.6c0 4-3.6 7.1-8 7.1-1 0-2-.2-2.9-.5L4 19.5l1.4-3.4A6.7 6.7 0 0 1 4 11.6c0-4 3.6-7.1 8-7.1s8 3.2 8 7.1Z" />
  </Base>
);

export const IconStar = (p: P & { filled?: boolean }) => (
  <svg width={p.size ?? 20} height={p.size ?? 20} viewBox="0 0 24 24" fill={p.filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden>
    <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.9L12 3.5Z" />
  </svg>
);
