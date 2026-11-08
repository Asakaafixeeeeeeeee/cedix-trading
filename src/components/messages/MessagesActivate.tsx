'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { jfetch, SystemAvatar } from './shared';

/**
 * Invitation activation — the ONLY way a device gains Messages access.
 * No email or password: the admin-issued single-use link connects this device
 * to the user's CediX account, then the app always opens straight to messages.
 */
export default function MessagesActivate() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [invite, setInvite] = useState<{ valid: boolean; email?: string; suggestedName?: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setInvite({ valid: false });
      return;
    }
    jfetch<{ valid: boolean; email?: string }>(`/api/messages/invite?token=${encodeURIComponent(token)}`)
      .then(setInvite)
      .catch(() => setInvite({ valid: false }));
  }, [token]);

  async function activate() {
    setBusy(true);
    setError('');
    try {
      await jfetch('/api/messages/register', { method: 'POST', body: JSON.stringify({ token }) });
      router.replace('/messages');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed');
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
          <p className="mt-1 max-w-xs text-center text-[13px] leading-relaxed text-[#8e8e93]">
            You were invited to receive private CediX Trading notifications for <b>{invite.email}</b> on this device.
          </p>
          {error && <p className="mt-4 text-center text-[12px] text-[#ff3b30]">{error}</p>}
          <button
            onClick={activate}
            disabled={busy}
            className="mt-8 w-full max-w-xs rounded-xl bg-[#007aff] py-3 text-[15px] font-semibold text-[#fff] disabled:opacity-50"
          >
            {busy ? 'Activating…' : 'Activate Messages'}
          </button>
          <p className="mt-4 max-w-xs text-center text-[11px] leading-relaxed text-[#8e8e93]">
            This device stays signed in. The CediX administrator can revoke access at any time.
          </p>
        </>
      )}
    </div>
  );
}
