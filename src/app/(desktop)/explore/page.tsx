import EarnSection from '@/components/EarnSection';

export const metadata = { title: 'Explore — Staking & Savings' };

export default function ExplorePage() {
  return (
    <div className="pt-6">
      <h1 className="text-2xl font-bold">Explore</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Financial tools to grow your assets — stake proof-of-stake coins or earn interest with flexible and fixed savings.
      </p>
      <EarnSection />
    </div>
  );
}
