import { Suspense } from 'react';
import DepositStatus from '@/components/mobile/DepositStatus';

export const metadata = { title: 'Deposit status | CediX' };

async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DepositStatus id={id} />;
}

export default function DepositStatusPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense>
      <Inner params={params} />
    </Suspense>
  );
}
