'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { jfetch, SystemAvatar } from './shared';

export default function MessagesLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await jfetch('/api/messages/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      router.replace('/messages');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 pb-16">
      <SystemAvatar size={72} />
      <h1 className="mt-4 text-[26px] font-bold">Messages</h1>
      <p className="mt-1 text-center text-[13px] text-[#8e8e93]">
        Private CediX Trading transaction notifications.
      </p>

      <form onSubmit={submit} className="mt-8 w-full max-w-xs space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          required
          className="w-full rounded-xl bg-[#f2f2f7] px-4 py-3 text-[14px] outline-none placeholder:text-[#8e8e93]"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          required
          className="w-full rounded-xl bg-[#f2f2f7] px-4 py-3 text-[14px] outline-none placeholder:text-[#8e8e93]"
        />
        {error && <p className="text-center text-[12px] text-[#ff3b30]">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-xl bg-[#007aff] py-3 text-[15px] font-semibold text-[#fff] disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 max-w-xs text-center text-[12px] leading-relaxed text-[#8e8e93]">
        Access is by invitation only. If you have an invitation link from the CediX team, open it to create your
        account.
      </p>
    </div>
  );
}
