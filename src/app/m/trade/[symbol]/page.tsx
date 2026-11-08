import { Suspense } from 'react';
import MobileTradeView from '@/components/mobile/MobileTradeView';

async function Inner({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return <MobileTradeView symbol={symbol.toUpperCase()} />;
}

export default function MobileTradePage({ params }: { params: Promise<{ symbol: string }> }) {
  return (
    <Suspense>
      <Inner params={params} />
    </Suspense>
  );
}
