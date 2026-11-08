import MarketTable from '@/components/MarketTable';

export const metadata = { title: 'Markets' };

export default function MarketsPage() {
  return (
    <div className="pt-6">
      <h1 className="mb-4 text-2xl font-bold">Markets</h1>
      <MarketTable />
    </div>
  );
}
