'use client';
import Link from 'next/link';
import { useState } from 'react';
import { post } from '@/lib/hooks';

export default function RegisterPage() {
  const [form, setForm] = useState({ email: '', username: '', phone: '', password: '' });
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
      await post('/api/auth/register', form);
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      setBusy(false);
    }
  }

  const input =
    'w-full rounded-lg border border-line bg-bg px-4 py-3 text-sm outline-none focus:border-accent';

  return (
    <div className="mx-auto mt-16 w-full max-w-md rounded-xl border border-line bg-panel p-8">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Start trading crypto with Ghanaian Cedis</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="Email" type="email" className={input} />
        <input value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="Username" className={input} />
        <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Phone (e.g. 024 123 4567) — optional" className={input} />
        <input value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Password (min 8 characters)" type="password" autoComplete="new-password" className={input} />
        {error && <p className="text-sm text-down">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-white py-3 font-semibold text-black hover:bg-gray-200 disabled:opacity-50">
          {busy ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-accent hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
