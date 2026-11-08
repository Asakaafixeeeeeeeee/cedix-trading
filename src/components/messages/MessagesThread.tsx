'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { iosFullTime, jfetch, SystemAvatar, useMessagesUser } from './shared';

type Msg = {
  id: string;
  sender: string;
  title: string | null;
  body: string;
  meta: { reference?: string } | null;
  createdAt: string;
};

type Thread = { id: string; name: string; system: boolean; messages: Msg[] };

export default function MessagesThread({ id }: { id: string }) {
  const { user, loading } = useMessagesUser();
  const [thread, setThread] = useState<Thread | null>(null);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  useEffect(() => {
    if (!user) return;
    let stop = false;
    async function load() {
      try {
        const d = await jfetch<{ conversation: Thread }>(`/api/messages/conversations/${id}`);
        if (stop) return;
        setThread(d.conversation);
        setError('');
        // Mark read (fire and forget)
        jfetch(`/api/messages/conversations/${id}`, { method: 'POST' }).catch(() => {});
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : 'Failed to load');
      }
    }
    load();
    const t = setInterval(load, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [user, id]);

  // Auto-scroll to the newest message when new ones arrive
  useEffect(() => {
    const count = thread?.messages.length ?? 0;
    if (count !== lastCount.current) {
      lastCount.current = count;
      bottomRef.current?.scrollIntoView({ behavior: count > 0 ? 'auto' : 'smooth' });
    }
  }, [thread?.messages.length]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#e5e5ea] border-t-[#9a9aa0]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#e5e5ea] bg-[#f9f9f9]/95 px-2 pb-2 pt-[calc(8px+env(safe-area-inset-top))] backdrop-blur">
        <div className="grid grid-cols-[64px_1fr_64px] items-center">
          <Link href="/messages" className="flex items-center gap-0.5 text-[#007aff]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            <span className="text-[15px]">Back</span>
          </Link>
          <div className="flex flex-col items-center">
            <SystemAvatar size={40} />
            <span className="mt-0.5 text-[11px] text-[#111]">{thread?.name ?? ''}</span>
          </div>
          <span />
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 space-y-1 px-4 pb-6 pt-3">
        {error && <p className="py-8 text-center text-[13px] text-[#8e8e93]">{error}</p>}
        {thread && thread.messages.length === 0 && (
          <p className="py-8 text-center text-[13px] text-[#8e8e93]">No messages yet.</p>
        )}
        {thread?.messages.map((m, i) => {
          const prev = thread.messages[i - 1];
          const gap = !prev || new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 30 * 60 * 1000;
          return (
            <div key={m.id}>
              {gap && (
                <p className="py-2 text-center text-[11px] text-[#8e8e93]">{iosFullTime(m.createdAt)}</p>
              )}
              <div className="flex justify-start">
                <div className="relative max-w-[82%] rounded-2xl bg-[#e9e9eb] px-3.5 py-2">
                  {m.title && <p className="text-[14px] font-semibold text-[#111]">{m.title}</p>}
                  <p className="whitespace-pre-line text-[14px] leading-snug text-[#111]">{m.body}</p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      {/* Read-only footer for system conversations */}
      <footer className="sticky bottom-0 border-t border-[#e5e5ea] bg-[#f9f9f9]/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2.5 text-center backdrop-blur">
        <p className="text-[12px] text-[#8e8e93]">
          {thread?.system ? 'CediX Trading notifications are read-only.' : ''}
        </p>
      </footer>
    </div>
  );
}
