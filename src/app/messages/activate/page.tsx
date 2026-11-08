import { Suspense } from 'react';
import MessagesActivate from '@/components/messages/MessagesActivate';

export const metadata = { title: 'Activate' };

export default function MessagesActivatePage() {
  return (
    <Suspense>
      <MessagesActivate />
    </Suspense>
  );
}
