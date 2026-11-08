import { Suspense } from 'react';
import MessagesThread from '@/components/messages/MessagesThread';

export const metadata = { title: 'Conversation' };

async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MessagesThread id={id} />;
}

export default function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense>
      <Inner params={params} />
    </Suspense>
  );
}
