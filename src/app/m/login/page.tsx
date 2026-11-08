'use client';
import Link from 'next/link';
import { useState } from 'react';
import { post } from '@/lib/hooks';

export default function MobileLogin() {
  const [form, setForm] = useState({ identifier: '', password: '' });
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
      await post('/api/auth/login', { identifier: form.identifier, password: form.password });
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
        <h1 className="mt-4 text-[20px] font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Log in to continue trading</p>
      </div>
      <form onSubmit={submit} className="mt-8 space-y-3">
        <input value={form.identifier} onChange={(e) => set('identifier', e.target.value)} placeholder="Email or username" className={input} />
        <input value={form.password} onChange={(e) => set('password', e.target.value)} type="password" placeholder="Password" className={input} />
        {error && <p className="text-sm text-down">{error}</p>}
        <button disabled={busy} className="w-full rounded-full bg-white py-3 text-[14px] font-bold text-black disabled:opacity-50">
          {busy ? 'Please wait…' : 'Log in'}
        </button>
        <Link href="/reset" className="block text-center text-xs text-muted">Forgot password?</Link>
      </form>
      <Link href="/register" className="mt-4 block w-full text-center text-sm font-semibold text-accent">
        New here? Create an account
      </Link>
      <p className="mt-8 text-center text-xs text-muted">
        <Link href="/" className="underline">Switch to desktop site</Link>
      </p>
    </div>
  );
}
