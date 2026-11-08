import type { Metadata, Viewport } from 'next';
import MessagesShell from '@/components/messages/MessagesShell';

export const metadata: Metadata = {
  title: { default: 'Messages', template: '%s | Messages' },
  description: 'Private transaction notifications',
  manifest: '/messages/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Messages' },
  icons: {
    icon: '/messages/icon-192.png',
    apple: '/messages/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

/**
 * Standalone layout for the Messages app (own PWA under /messages).
 * Always light, iOS-style, completely separate from the CediX navigation.
 */
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <MessagesShell>{children}</MessagesShell>;
}
