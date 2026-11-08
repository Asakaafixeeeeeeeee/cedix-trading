'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/m', label: 'Home', icon: '🏠', exact: true },
  { href: '/m/markets', label: 'Markets', icon: '📊' },
  { href: '/m/trade/BTCUSDT', label: 'Trade', icon: '🔄', match: '/m/trade' },
  { href: '/m/orbit', label: 'Orbit', icon: '🪐' },
  { href: '/m/assets', label: 'Assets', icon: '💰' },
];

export default function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.match ?? t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                active ? 'text-white' : 'text-muted'
              }`}
            >
              <span className={`text-xl leading-none ${active ? '' : 'opacity-60 grayscale'}`}>{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
