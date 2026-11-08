export function fmtNum(n: number, maxDecimals = 8): string {
  if (!isFinite(n)) return '-';
  const abs = Math.abs(n);
  let decimals = maxDecimals;
  if (abs >= 1000) decimals = Math.min(2, maxDecimals);
  else if (abs >= 1) decimals = Math.min(4, maxDecimals);
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

export function fmtUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

export function fmtGHS(n: number): string {
  return 'GH₵ ' + n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

export function fmtPrice(n: number, precision = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision });
}

export function fmtCompact(n: number): string {
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString();
}
