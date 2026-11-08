import { Suspense } from 'react';
import TradeView from '@/components/TradeView';

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return { title: `${symbol} Spot Trading` };
}

async function TradeInner({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return <TradeView symbol={symbol.toUpperCase()} />;
}

export default function TradePage({ params }: { params: Promise<{ symbol: string }> }) {
  return (
    <Suspense>
      <TradeInner params={params} />
    </Suspense>
  );
}
