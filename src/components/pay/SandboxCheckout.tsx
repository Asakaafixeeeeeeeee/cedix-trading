'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePoll, post } from '@/lib/hooks';
import { fmtGHS, fmtNum } from '@/lib/format';
import { IconCheckCircle, IconAlertCircle } from '@/components/icons';

type Deposit = {
  id: string;
  asset: string;
  amountGHS: string;
  amountAsset: string;
  method: string;
  status: string;
  payerPhone: string | null;
};

/**
 * Payteller SANDBOX checkout — simulates the hosted payment page.
 * In live mode users are redirected to Payteller's real gateway instead.
 */
export default function SandboxCheckout({ refId }: { refId: string }) {
  const ref = refId;
  const router = useRouter();
  const { data, refresh } = usePoll<{ deposit: Deposit }>(`/api/deposit/${ref}`, 0);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<'success' | 'failed' | null>(null);

  const dep = data?.deposit;

  useEffect(() => {
    if (dep?.status === 'COMPLETED') setDone('success');
  }, [dep?.status]);

  async function simulate(status: 'success' | 'failed') {
    setBusy(status);
    try {
      await post('/api/payteller/webhook', { reference: ref, status, sandbox: true });
      setDone(status);
      refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-8">
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold">
            Pay<span className="text-gold">teller</span>
          </div>
          <span className="rounded-full border border-gold/50 px-2.5 py-0.5 text-[10px] font-bold uppercase text-gold">
            Sandbox
          </span>
        </div>

        {!done && dep && (
          <>
            <div className="num mt-6 text-center">
              <div className="text-sm text-muted">Amount due</div>
              <div className="mt-1 text-4xl font-bold">{fmtGHS(Number(dep.amountGHS))}</div>
              <div className="mt-2 text-sm text-muted">
                → {fmtNum(Number(dep.amountAsset))} {dep.asset} on CediX
              </div>
            </div>
            <div className="mt-6 rounded-lg border border-line bg-bg p-4 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-muted">Merchant</span>
                <span>CediX Exchange</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted">Channel</span>
                <span>{dep.method === 'MOMO' ? `Mobile Money${dep.payerPhone ? ` · ${dep.payerPhone}` : ''}` : dep.method === 'CARD' ? 'Bank Card' : 'Bank Transfer'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted">Reference</span>
                <span className="num text-xs">{dep.id.slice(0, 16)}…</span>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-muted">
              This is a simulated gateway. In production, the customer would approve a MoMo prompt or enter card details here.
            </p>
            <div className="mt-5 space-y-2">
              <button
                onClick={() => simulate('success')}
                disabled={!!busy}
                className="w-full rounded-lg bg-up py-3 font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                {busy === 'success' ? 'Processing…' : 'Simulate Successful Payment'}
              </button>
              <button
                onClick={() => simulate('failed')}
                disabled={!!busy}
                className="w-full rounded-lg border border-down py-3 font-semibold text-down hover:bg-down/10 disabled:opacity-50"
              >
                Simulate Failed Payment
              </button>
            </div>
          </>
        )}

        {done === 'success' && (
          <div className="mt-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-up/15 text-up"><IconCheckCircle size={34} /></div>
            <h2 className="mt-4 text-xl font-bold">Payment Successful</h2>
            <p className="mt-2 text-sm text-muted">
              {dep ? `${fmtNum(Number(dep.amountAsset))} ${dep.asset} has been credited to your CediX account.` : ''}
            </p>
            <button onClick={() => router.push('/assets')} className="mt-6 w-full rounded-lg bg-white py-3 font-semibold text-black hover:bg-gray-200">
              View My Assets
            </button>
          </div>
        )}

        {done === 'failed' && (
          <div className="mt-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-down/15 text-down"><IconAlertCircle size={34} /></div>
            <h2 className="mt-4 text-xl font-bold">Payment Failed</h2>
            <p className="mt-2 text-sm text-muted">No funds were taken. You can try again anytime.</p>
            <button onClick={() => router.push('/deposit')} className="mt-6 w-full rounded-lg bg-white py-3 font-semibold text-black hover:bg-gray-200">
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
