'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { post, useUser } from '@/lib/hooks';
import { IconLock, IconShield } from '@/components/icons';

export default function AdminLoginPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [loading]);

  async function unlock() {
    if (pin.length !== 6) return;
    setBusy(true);
    setError('');
    try {
      await post('/api/admin/pin', { pin });
      router.push('/admin');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PIN verification failed');
      setPin('');
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  useEffect(() => {
    if (pin.length === 6 && !busy) unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const notAdmin = !loading && (!user || user.role !== 'ADMIN');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm text-center">
        <span className="inline-flex rounded-2xl bg-panel p-4 text-foreground">
          <IconShield size={34} />
        </span>
        <h1 className="mt-5 text-2xl font-black tracking-tight">CEDIX ADMIN</h1>

        {notAdmin ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              This area is restricted. Sign in with an authorized administrator account to continue.
            </p>
            <Link href="/login" className="mt-6 inline-block w-full rounded-full bg-white py-3.5 font-bold text-black">
              Sign in
            </Link>
            <Link href="/" className="mt-3 block text-sm text-muted">Back to CediX</Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">Enter Your 6-Digit Access PIN</p>

            {/* Hidden input drives the PIN boxes */}
            <input
              ref={inputRef}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="absolute -left-[9999px]"
              aria-label="Admin PIN"
            />
            <button className="mt-6 flex w-full justify-center gap-2.5" onClick={() => inputRef.current?.focus()}>
              {Array.from({ length: 6 }).map((_, i) => (
                <span
                  key={i}
                  className={`flex h-14 w-11 items-center justify-center rounded-xl border-2 text-xl font-bold transition ${
                    i === pin.length ? 'border-accent' : pin[i] ? 'border-line bg-panel' : 'border-line'
                  }`}
                >
                  {pin[i] ? '•' : ''}
                </span>
              ))}
            </button>

            {error && <p className="mt-4 text-sm font-medium text-down">{error}</p>}

            <button
              onClick={unlock}
              disabled={busy || pin.length !== 6}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 font-bold text-black transition active:scale-[0.99] disabled:opacity-40"
            >
              <IconLock size={16} />
              {busy ? 'Verifying…' : 'UNLOCK ADMIN DASHBOARD'}
            </button>
            <p className="mt-5 text-[12px] leading-relaxed text-muted">
              Signed in as <span className="font-semibold text-foreground">@{user?.username}</span>. Sessions lock
              automatically after 30 minutes. All attempts are recorded.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
