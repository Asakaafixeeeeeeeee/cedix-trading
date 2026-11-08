import { Suspense } from 'react';
import SandboxCheckout from '@/components/pay/SandboxCheckout';

export const metadata = { title: 'Payteller Sandbox Checkout' };

async function Inner({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return <SandboxCheckout refId={ref} />;
}

export default function SandboxPayPage({ params }: { params: Promise<{ ref: string }> }) {
  return (
    <Suspense>
      <Inner params={params} />
    </Suspense>
  );
}
