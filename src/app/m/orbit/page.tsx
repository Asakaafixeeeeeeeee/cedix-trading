import OrbitFeed from '@/components/OrbitFeed';

export const metadata = { title: 'Orbit' };

export default function MobileOrbitPage() {
  return (
    <div className="px-4 pt-4">
      <h1 className="mb-4 text-xl font-bold">🪐 Orbit</h1>
      <OrbitFeed />
    </div>
  );
}
