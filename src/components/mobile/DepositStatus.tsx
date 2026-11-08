'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IconCheckCircle, IconAlertCircle, IconClock } from '@/components/icons';
import { fmtGHS, fmtNum } from '@/lib/format';

type Deposit = {
  id: string;
  asset: string;
  amountGHS: string;
  amountAsset: string;
  status: 'INITIATED' | 'AWAITING_PAYMENT' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  method: string;
  createdAt: string;
};

const OPEN = ['INITIATED', 'AWAITING_PAYMENT', 'PROCESSING'];

/**
 * Landing page after returning from the Payteller hosted checkout.
 * It only POLLS our backend's verified status — returning here is never
 * treated as proof of payment and never credits anything by itself.
 */
export default function DepositStatus({ id }: { id: string }) {
  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      try {
        const res = await fetch(`/api/deposit/${id}`, { cache: 'no-store' });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Deposit not found');
        const data = await res.json();
        if (stop) return;
        setDeposit(data.deposit);
        setError('');
        if (OPEN.includes(data.deposit.status)) timer = setTimeout(tick, 6000);
      } catch (e) {
        if (stop) return;
        setError(e instanceof Error ? e.message : 'Failed to load');
        timer = setTimeout(tick, 8000);
      }
    }
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id]);

  if (!deposit) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-transparent" />
        <p className="mt-4 text-xs text-muted">{error || 'Loading deposit…'}</p>
      </div>
    );
  }

  const pending = OPEN.includes(deposit.status);
  const success = deposit.status === 'COMPLETED';

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 pb-24 text-center">
      {success ? (
        <IconCheckCircle size={56} className="text-emerald-500" />
      ) : pending ? (
        <span className="relative flex h-14 w-14 items-center justify-center">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-gray-200 border-t-transparent" />
          <IconClock size={26} className="text-muted" />
        </span>
      ) : (
        <IconAlertCircle size={56} className="text-rose-500" />
      )}

      <h1 className="mt-4 text-[17px] font-bold">
        {success ? 'Deposit successful' : pending ? 'Waiting for confirmation' : 'Payment not completed'}
      </h1>

      <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted">
        {success && (
          <>
            {fmtNum(Number(deposit.amountAsset))} {deposit.asset} has been credited to your funding wallet
            for your {fmtGHS(Number(deposit.amountGHS))} payment.
          </>
        )}
        {pending && (
          <>
            We are confirming your {fmtGHS(Number(deposit.amountGHS))} payment with Payteller. Your{' '}
            {deposit.asset} will be credited automatically once the payment is verified — this page
            updates by itself. If you cancelled the payment, no money will be taken.
          </>
        )}
        {!success && !pending && (
          <>
            This payment was {deposit.status === 'CANCELLED' ? 'cancelled' : 'not successful'} and
            nothing has been credited. If you were charged, the amount will be reversed by your
            mobile money provider.
          </>
        )}
      </p>

      <div className="mt-6 w-full max-w-xs space-y-2">
        {success && (
          <Link href="/m/assets" className="block rounded-xl bg-white py-3 text-[13px] font-semibold text-black">
            View assets
          </Link>
        )}
        {!success && !pending && (
          <Link href="/m/deposit" className="block rounded-xl bg-white py-3 text-[13px] font-semibold text-black">
            Try again
          </Link>
        )}
        <Link href="/m" className="block rounded-xl bg-panel py-3 text-[13px] font-semibold">
          Back to home
        </Link>
      </div>

      <p className="mt-6 text-[10px] text-muted">Ref: {deposit.id}</p>
    </div>
  );
}
