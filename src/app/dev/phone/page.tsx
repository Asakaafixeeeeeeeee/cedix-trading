import { notFound } from 'next/navigation';
import PhoneSimulator from '@/components/dev/PhoneSimulator';

export const metadata = { title: 'iPhone Preview (dev)' };

/**
 * DEVELOPMENT-ONLY iPhone 17 Pro Max simulator preview.
 * Open http://localhost:3000/dev/phone in the VS Code browser preview.
 * Returns 404 in production — customers can never see this page.
 */
export default function PhonePreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <PhoneSimulator />;
}
