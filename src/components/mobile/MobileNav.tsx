'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconHome, IconMarkets, IconTrade, IconOrbit, IconAssets } from '@/components/icons';

const TABS = [
  { href: '/m', label: 'Home', icon: IconHome, exact: true },
  { href: '/m/markets', label: 'Markets', icon: IconMarkets },
  { href: '/m/trade/BTCUSDT', label: 'Trade', icon: IconTrade, match: '/m/trade', center: true },
  { href: '/m/orbit', label: 'Orbit', icon: IconOrbit },
  { href: '/m/assets', label: 'Assets', icon: IconAssets },
];

export default function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2">
      <div className="mx-auto flex max-w-md items-center justify-between rounded-full border border-line bg-bg/95 px-3 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl" style={{ width: 'min(92%, 28rem)' }}>
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.match ?? t.href);
          const Icon = t.icon;
          if (t.center) {
            return (
              <Link key={t.href} href={t.href} className="flex flex-col items-center gap-0.5" aria-label={t.label}>
                <span className={`flex h-11 w-11 items-center justify-center rounded-full transition ${active ? 'bg-white text-black' : 'bg-white text-black opacity-90'}`}>
                  <Icon size={21} strokeWidth={2} />
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-label={t.label}
              className={`flex min-w-[56px] flex-col items-center gap-0.5 rounded-full px-3 py-1.5 transition ${
                active ? 'bg-panel font-semibold text-foreground' : 'text-muted'
              }`}
            >
              <Icon size={21} strokeWidth={active ? 2.1 : 1.8} />
              <span className="text-[10px] font-medium">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
