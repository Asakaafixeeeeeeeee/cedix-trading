import EarnSection from '@/components/EarnSection';

export const metadata = { title: 'Earn' };

export default function MobileExplorePage() {
  return (
    <div className="px-4 pt-4">
      <h1 className="text-xl font-bold">Earn</h1>
      <p className="mb-4 mt-1 text-xs text-muted">Stake and save to grow your crypto.</p>
      <EarnSection />
    </div>
  );
}
