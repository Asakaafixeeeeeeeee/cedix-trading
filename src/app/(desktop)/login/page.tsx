'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { post } from '@/lib/hooks';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await post('/api/auth/login', { identifier, password });
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-16 w-full max-w-md rounded-xl border border-line bg-panel p-8">
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Log in to your CediX account</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Email or username"
          autoComplete="username"
          className="w-full rounded-lg border border-line bg-bg px-4 py-3 text-sm outline-none focus:border-accent"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className="w-full rounded-lg border border-line bg-bg px-4 py-3 text-sm outline-none focus:border-accent"
        />
        {error && <p className="text-sm text-down">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-white py-3 font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
        >
          {busy ? 'Logging in…' : 'Log in'}
        </button>
        <Link href="/reset" className="block text-center text-xs text-muted hover:underline">Forgot password?</Link>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        New to CediX?{' '}
        <Link href="/register" className="text-accent hover:underline">
          Create an account
        </Link>
      </p>
      <div className="mt-6 rounded-lg border border-line bg-panel2 p-3 text-xs text-muted">
        <b>Demo accounts</b>
        <div className="mt-1">User: demo@cedix.gh / Demo123!</div>
        <div>Admin: admin@cedix.gh / Admin123!</div>
      </div>
    </div>
  );
}
