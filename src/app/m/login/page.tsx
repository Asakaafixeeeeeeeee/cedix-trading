'use client';
import Link from 'next/link';
import { useState } from 'react';
import { post } from '@/lib/hooks';

export default function MobileLogin() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ identifier: '', email: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') {
        await post('/api/auth/login', { identifier: form.identifier, password: form.password });
      } else {
        await post('/api/auth/register', { email: form.email, username: form.username, password: form.password });
      }
      window.location.href = '/m';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setBusy(false);
    }
  }

  const input = 'w-full rounded-xl border border-line bg-panel px-4 py-3.5 text-sm outline-none focus:border-accent';

  return (
    <div className="px-6 pt-16">
      <div className="text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl font-black text-black">C</span>
        <h1 className="mt-4 text-2xl font-bold">{mode === 'login' ? 'Welcome back' : 'Join CediX'}</h1>
        <p className="mt-1 text-sm text-muted">Crypto trading made for Ghana 🇬🇭</p>
      </div>
      <form onSubmit={submit} className="mt-8 space-y-3">
        {mode === 'login' ? (
          <input value={form.identifier} onChange={(e) => set('identifier', e.target.value)} placeholder="Email or username" className={input} />
        ) : (
          <>
            <input value={form.email} onChange={(e) => set('email', e.target.value)} type="email" placeholder="Email" className={input} />
            <input value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="Username" className={input} />
          </>
        )}
        <input value={form.password} onChange={(e) => set('password', e.target.value)} type="password" placeholder="Password" className={input} />
        {error && <p className="text-sm text-down">{error}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-white py-3.5 font-bold text-black disabled:opacity-50">
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
      <button onClick={() => setMode((m) => (m === 'login' ? 'register' : 'login'))} className="mt-4 w-full text-center text-sm text-accent">
        {mode === 'login' ? "New here? Create an account" : 'Already have an account? Log in'}
      </button>
      <p className="mt-8 text-center text-xs text-muted">
        <Link href="/" className="underline">Switch to desktop site</Link>
      </p>
    </div>
  );
}
