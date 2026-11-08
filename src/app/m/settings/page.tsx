'use client';
import Link from 'next/link';
import { useDisplayPrefs } from '@/lib/prefs';
import { useUser } from '@/lib/hooks';
import { IconSun, IconMoon } from '@/components/icons';

export default function MobileSettings() {
  const { theme, setTheme, currency, setCurrency, rate } = useDisplayPrefs();
  const { user } = useUser();

  return (
    <div className="px-4 pt-3">
      <div className="flex items-center gap-3 py-2">
        <Link href="/m/assets" className="text-xl text-muted">‹</Link>
        <h1 className="text-lg font-bold">Settings</h1>
      </div>

      {user && (
        <div className="mt-3 rounded-2xl bg-panel p-4">
          <div className="text-[15px] font-bold">{user.displayName || user.username}</div>
          <div className="mt-0.5 text-[13px] text-muted">@{user.username} · {user.email}</div>
        </div>
      )}

      <h2 className="mt-6 text-[13px] font-semibold uppercase tracking-wide text-muted">Appearance</h2>
      <div className="mt-2 grid grid-cols-2 gap-2.5">
        <button
          onClick={() => setTheme('light')}
          className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 ${theme === 'light' ? 'border-accent bg-panel' : 'border-line bg-panel'}`}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ffffff] text-[#f59e0b] shadow-sm ring-1 ring-[#e5e7eb]"><IconSun size={20} /></span>
          <span className="text-sm font-semibold">Light</span>
          {theme === 'light' && <span className="text-[11px] font-medium text-accent">Selected</span>}
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 ${theme === 'dark' ? 'border-accent bg-panel' : 'border-line bg-panel'}`}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0b0e11] text-[#eaecef]"><IconMoon size={20} /></span>
          <span className="text-sm font-semibold">Dark</span>
          {theme === 'dark' && <span className="text-[11px] font-medium text-accent">Selected</span>}
        </button>
      </div>

      <h2 className="mt-6 text-[13px] font-semibold uppercase tracking-wide text-muted">Display Currency</h2>
      <div className="mt-2 overflow-hidden rounded-2xl bg-panel">
        {(
          [
            ['USD', 'US Dollar', '$', 'Default'],
            ['GHS', 'Ghanaian Cedi', 'GH₵', rate ? `1 USD = ${rate.toFixed(4)} GHS (live)` : 'Live rate'],
          ] as const
        ).map(([code, name, sym, sub]) => (
          <button
            key={code}
            onClick={() => setCurrency(code)}
            className="flex w-full items-center gap-3 border-b border-line/60 px-4 py-4 last:border-0"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-panel2 text-sm font-bold">{sym}</span>
            <span className="flex-1 text-left">
              <span className="block text-[15px] font-semibold">{code} — {name}</span>
              <span className="block text-[12px] text-muted">{sub}</span>
            </span>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${currency === code ? 'border-accent' : 'border-line'}`}>
              {currency === code && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 px-1 text-[12px] leading-relaxed text-muted">
        Display currency only changes how values are shown. Your actual balances are never converted — GH₵ values
        use the live USD/GHS exchange rate, updated automatically.
      </p>
    </div>
  );
}
