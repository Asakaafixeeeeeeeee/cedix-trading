'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { jfetch, SystemAvatar } from './shared';

export default function MessagesRegister() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [invite, setInvite] = useState<{ valid: boolean; email?: string; suggestedName?: string } | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setInvite({ valid: false });
      return;
    }
    jfetch<{ valid: boolean; email?: string; suggestedName?: string }>(`/api/messages/invite?token=${encodeURIComponent(token)}`)
      .then((d) => {
        setInvite(d);
        if (d.suggestedName) setDisplayName(d.suggestedName);
      })
      .catch(() => setInvite({ valid: false }));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError('Passwords do not match');
    setBusy(true);
    setError('');
    try {
      await jfetch('/api/messages/register', { method: 'POST', body: JSON.stringify({ token, displayName, password }) });
      router.replace('/messages');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 pb-16">
      <SystemAvatar size={72} />
      <h1 className="mt-4 text-[26px] font-bold">Messages</h1>

      {invite === null ? (
        <p className="mt-6 text-[13px] text-[#8e8e93]">Checking your invitation…</p>
      ) : !invite.valid ? (
        <div className="mt-6 max-w-xs text-center">
          <p className="text-[14px] font-medium">This invitation is not valid</p>
          <p className="mt-2 text-[12px] leading-relaxed text-[#8e8e93]">
            The link may have expired or already been used. Please contact the CediX team for a new invitation.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-1 text-center text-[13px] text-[#8e8e93]">
            You were invited to receive private notifications for <b>{invite.email}</b>.
          </p>
          <form onSubmit={submit} className="mt-6 w-full max-w-xs space-y-3">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              required
              className="w-full rounded-xl bg-[#f2f2f7] px-4 py-3 text-[14px] outline-none placeholder:text-[#8e8e93]"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password (min 8 characters)"
              autoComplete="new-password"
              required
              minLength={8}
              className="w-full rounded-xl bg-[#f2f2f7] px-4 py-3 text-[14px] outline-none placeholder:text-[#8e8e93]"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              autoComplete="new-password"
              required
              className="w-full rounded-xl bg-[#f2f2f7] px-4 py-3 text-[14px] outline-none placeholder:text-[#8e8e93]"
            />
            {error && <p className="text-center text-[12px] text-[#ff3b30]">{error}</p>}
            <button
              disabled={busy}
              className="w-full rounded-xl bg-[#007aff] py-3 text-[15px] font-semibold text-[#fff] disabled:opacity-50"
            >
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
