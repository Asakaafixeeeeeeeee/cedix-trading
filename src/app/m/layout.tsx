import type { Metadata, Viewport } from 'next';
import MobileNav from '@/components/mobile/MobileNav';
import SwRegister from '@/components/mobile/SwRegister';

export const metadata: Metadata = {
  title: { default: 'CediX Mobile', template: '%s | CediX Mobile' },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'CediX' },
};

export const viewport: Viewport = {
  themeColor: '#0a0c0f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-lg pb-32">
      <SwRegister />
      {children}
      <MobileNav />
    </div>
  );
}
