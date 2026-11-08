import { Suspense } from 'react';
import MessagesRegister from '@/components/messages/MessagesRegister';

export const metadata = { title: 'Create account' };

export default function MessagesRegisterPage() {
  return (
    <Suspense>
      <MessagesRegister />
    </Suspense>
  );
}
