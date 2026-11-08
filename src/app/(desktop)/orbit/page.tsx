import OrbitFeed from '@/components/OrbitFeed';

export const metadata = { title: 'Orbit Community' };

export default function OrbitPage() {
  return (
    <div className="pt-6">
      <div className="mx-auto mb-6 max-w-2xl">
        <h1 className="text-2xl font-bold">Orbit</h1>
        <p className="mt-1 text-sm text-muted">
          The CediX community — share charts, screenshots and market ideas. Protected by AI-driven fraud moderation.
        </p>
      </div>
      <OrbitFeed />
    </div>
  );
}
