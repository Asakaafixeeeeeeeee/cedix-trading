'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IconLock, IconShield } from '@/components/icons';

export default function AdminLoginPage() {
  const router = useRouter();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/auth', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setConfigured(Boolean(d.configured));
        setAdminEmail(d.email ?? '');
        if (d.email) setEmail(d.email);
      })
      .catch(() => setConfigured(true));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!configured && password !== confirm) return setError('Passwords do not match');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configured ? { action: 'login', email, password } : { action: 'setup', pin, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Authentication failed');
      router.push('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm text-center">
        <span className="inline-flex rounded-2xl bg-panel p-4 text-foreground">
          <IconShield size={34} />
        </span>
        <h1 className="mt-5 text-2xl font-black tracking-tight">CEDIX ADMIN</h1>

        {configured === null ? (
          <p className="mt-4 text-sm text-muted">Checking…</p>
        ) : configured ? (
          <>
            <p className="mt-2 text-sm text-muted">Sign in with your administrator email and password.</p>
            <form onSubmit={submit} className="mt-6 space-y-3 text-left">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Administrator email"
                autoComplete="username"
                required
                className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
              />
              {error && <p className="text-sm font-medium text-down">{error}</p>}
              <button
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 font-bold text-black transition active:scale-[0.99] disabled:opacity-40"
              >
                <IconLock size={16} />
                {busy ? 'Signing in…' : 'Sign in to Admin'}
              </button>
            </form>
            <p className="mt-5 text-[12px] leading-relaxed text-muted">
              Elevated sessions expire after 8 hours. All sign-in attempts are recorded with IP address.
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              <span className="font-semibold text-foreground">One-time secure setup.</span> Confirm your current
              6-digit admin PIN, then choose your new administrator password for{' '}
              <span className="font-semibold text-foreground">{adminEmail}</span>. The PIN is retired permanently
              after this step.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-3 text-left">
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Current 6-digit admin PIN"
                inputMode="numeric"
                required
                className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-center font-mono text-sm tracking-[0.4em] outline-none focus:border-accent"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (min 10 characters)"
                autoComplete="new-password"
                minLength={10}
                required
                className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                required
                className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
              />
              {error && <p className="text-sm font-medium text-down">{error}</p>}
              <button
                disabled={busy || pin.length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 font-bold text-black transition active:scale-[0.99] disabled:opacity-40"
              >
                <IconLock size={16} />
                {busy ? 'Saving…' : 'Set password & unlock dashboard'}
              </button>
            </form>
            <p className="mt-5 text-[12px] leading-relaxed text-muted">
              Your password is stored only as a bcrypt hash — it is never displayed or saved in plain text.
            </p>
          </>
        )}
        <Link href="/" className="mt-4 block text-sm text-muted">Back to CediX</Link>
      </div>
    </div>
  );
}
