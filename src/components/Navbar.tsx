'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useUser, post } from '@/lib/hooks';

const LINKS = [
  { href: '/markets', label: 'Markets' },
  { href: '/trade/BTCUSDT', label: 'Trade', match: '/trade' },
  { href: '/p2p', label: 'P2P' },
  { href: '/orbit', label: 'Orbit' },
  { href: '/explore', label: 'Explore' },
  { href: '/assets', label: 'Assets' },
];

export default function Navbar() {
  const { user, loading } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    await post('/api/auth/logout');
    router.push('/');
    router.refresh();
    window.location.reload();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white font-black text-black">C</span>
          CediX
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href || (l.match && pathname.startsWith(l.match));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? 'text-white' : 'text-muted hover:text-white'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {!loading && user ? (
            <>
              <Link
                href="/deposit"
                className="rounded-md bg-white px-4 py-1.5 text-sm font-semibold text-black hover:bg-gray-200"
              >
                Deposit
              </Link>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm hover:bg-panel2"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold">
                    {(user.displayName || user.username).slice(0, 1).toUpperCase()}
                  </span>
                  {user.username}
                </button>
                {menuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-line bg-panel shadow-xl"
                    onMouseLeave={() => setMenuOpen(false)}
                  >
                    <Link href="/assets" className="block px-4 py-2.5 text-sm hover:bg-panel2" onClick={() => setMenuOpen(false)}>My Assets</Link>
                    <Link href="/withdraw" className="block px-4 py-2.5 text-sm hover:bg-panel2" onClick={() => setMenuOpen(false)}>Withdraw (Fiat)</Link>
                    <Link href="/m" className="block px-4 py-2.5 text-sm hover:bg-panel2" onClick={() => setMenuOpen(false)}>📱 Mobile App</Link>
                    {user.role === 'ADMIN' && (
                      <Link href="/admin" className="block px-4 py-2.5 text-sm text-gold hover:bg-panel2" onClick={() => setMenuOpen(false)}>Admin Dashboard</Link>
                    )}
                    <button onClick={logout} className="block w-full px-4 py-2.5 text-left text-sm text-down hover:bg-panel2">
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : !loading ? (
            <>
              <Link href="/login" className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-white">
                Log in
              </Link>
              <Link href="/register" className="rounded-md bg-white px-4 py-1.5 text-sm font-semibold text-black hover:bg-gray-200">
                Sign up
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
