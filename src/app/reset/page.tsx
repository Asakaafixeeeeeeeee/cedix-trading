'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function ResetForm() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const emailParam = params.get('email') ?? '';

  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const hasToken = Boolean(token);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (hasToken && password !== confirm) return setError('Passwords do not match');
    setBusy(true);
    try {
      const res = await fetch(hasToken ? '/api/auth/reset' : '/api/auth/reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hasToken ? { email, token, password } : { email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      if (hasToken) setDone(true);
      else setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  const input = 'w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-xl font-bold">
          {done ? 'Password updated' : hasToken ? 'Set a new password' : 'Reset your password'}
        </h1>

        {done ? (
          <div className="mt-4 text-center">
            <p className="text-sm text-muted">Your password has been changed. You can now sign in with it.</p>
            <Link href="/m/login" className="mt-5 inline-block w-full rounded-full bg-white py-3 text-center text-sm font-bold text-black">
              Sign in
            </Link>
          </div>
        ) : sent ? (
          <p className="mt-4 text-center text-sm leading-relaxed text-muted">
            If an account exists for <span className="font-semibold text-foreground">{email}</span>, a reset link is
            on its way. Check your inbox (and spam folder) — the link expires in 30 minutes.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            {!hasToken && (
              <p className="text-center text-xs leading-relaxed text-muted">
                Enter your account email and we will send you a secure reset link.
              </p>
            )}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className={input} />
            {hasToken && (
              <>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (min 8 characters)" minLength={8} required className={input} />
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" required className={input} />
              </>
            )}
            {error && <p className="text-center text-xs text-down">{error}</p>}
            <button disabled={busy} className="w-full rounded-full bg-white py-3 text-sm font-bold text-black disabled:opacity-40">
              {busy ? 'Please wait…' : hasToken ? 'Save new password' : 'Send reset link'}
            </button>
          </form>
        )}
        {!done && (
          <Link href="/m/login" className="mt-5 block text-center text-xs text-muted">Back to sign in</Link>
        )}
      </div>
    </div>
  );
}

export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
