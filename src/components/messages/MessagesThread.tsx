'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { iosFullTime, jfetch, ConversationAvatar, useMessagesUser, type SenderInfo } from './shared';

type Msg = {
  id: string;
  sender: string;
  title: string | null;
  body: string;
  meta: { reference?: string } | null;
  createdAt: string;
};

type Thread = { id: string; name: string; system: boolean; sender: SenderInfo; messages: Msg[] };

/** Render URLs as blue links and long provider references as blue text (iOS SMS style). */
function renderBody(text: string, mine: boolean) {
  const parts = text.split(/(https?:\/\/[^\s]+|\b\d{10,}\b)/g);
  return parts.map((p, i) => {
    if (/^https?:\/\//.test(p)) {
      return (
        <a key={i} href={p} target="_blank" rel="noopener noreferrer" className={`${mine ? 'text-[#dbeaff]' : 'text-[#007aff]'} underline break-all`}>
          {p}
        </a>
      );
    }
    if (/^\d{10,}$/.test(p)) {
      return (
        <span key={i} className={`${mine ? 'text-[#dbeaff]' : 'text-[#007aff]'} underline`}>
          {p}
        </span>
      );
    }
    return p;
  });
}

export default function MessagesThread({ id }: { id: string }) {
  const { user, loading } = useMessagesUser();
  const [thread, setThread] = useState<Thread | null>(null);
  const [otherUnread, setOtherUnread] = useState(0);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
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
        jfetch(`/api/messages/conversations/${id}`, { method: 'POST' }).catch(() => {});
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : 'Failed to load');
      }
    }
    load();
    const t = setInterval(load, 5000);
    const loadUnread = () =>
      jfetch<{ unread: number }>('/api/messages/unread').then((d) => setOtherUnread(d.unread)).catch(() => {});
    loadUnread();
    const u = setInterval(loadUnread, 8000);
    return () => {
      stop = true;
      clearInterval(t);
      clearInterval(u);
    };
  }, [user, id]);

  useEffect(() => {
    const count = thread?.messages.length ?? 0;
    if (count !== lastCount.current) {
      lastCount.current = count;
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [thread?.messages.length]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await jfetch(`/api/messages/conversations/${id}`, { method: 'PUT', body: JSON.stringify({ body: text }) });
      setDraft('');
      const d = await jfetch<{ conversation: Thread }>(`/api/messages/conversations/${id}`);
      setThread(d.conversation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#e5e5ea] border-t-[#9a9aa0]" />
      </div>
    );
  }

  const canReply = Boolean(thread?.sender?.allowReplies);

  return (
    <div className="flex min-h-dvh flex-col bg-[#f7f7f8]" style={{ animation: 'msg-slide-in .22s ease-out' }}>
      <style>{'@keyframes msg-slide-in{from{opacity:.4;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}'}</style>
      {/* Header — floating glass controls over the scrolling conversation */}
      <header className="pointer-events-none sticky top-0 z-10 px-3 pb-1.5 pt-[calc(8px+env(safe-area-inset-top))]">
        <div className="pointer-events-auto relative flex flex-col items-center">
          <Link
            href="/messages"
            aria-label="Back to messages"
            className={`msg-glass absolute left-0 top-1 flex items-center gap-2 rounded-full py-[8px] pl-3 ${otherUnread > 0 ? 'pr-[8px]' : 'pr-3'}`}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 4.5L7.5 12l7.5 7.5" />
            </svg>
            {otherUnread > 0 && (
              <span className="flex min-w-[36px] items-center justify-center rounded-full bg-[#0a0a0a] px-2.5 py-[3px] text-[13px] font-semibold leading-[18px] text-[#ffffff]">
                {otherUnread}
              </span>
            )}
          </Link>
          <ConversationAvatar sender={thread?.sender ?? null} size={62} />
          <span className="msg-glass-soft -mt-2 flex items-center gap-0.5 rounded-full px-3 py-1">
            <span className="max-w-[180px] truncate text-[13px] font-semibold text-[#111]">{thread?.name ?? ''}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="3" strokeLinecap="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </span>
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
          const mine = m.sender === 'USER';
          return (
            <div key={m.id}>
              {gap && <p className="py-2 text-center text-[11px] text-[#8e8e93]">{iosFullTime(m.createdAt)}</p>}
              <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`relative max-w-[80%] rounded-[18px] px-3.5 py-2 ${mine ? 'bubble-out bg-[#007aff]' : 'bubble-in bg-[#e9e9eb]'}`}>
                  {m.title && !mine && <p className="relative z-[1] text-[15px] font-semibold leading-snug text-[#111]">{m.title}</p>}
                  <p className={`relative z-[1] whitespace-pre-line text-[15px] leading-snug ${mine ? 'text-[#fff]' : 'text-[#111]'}`}>
                    {renderBody(m.body, mine)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      {/* Composer (admin-enabled senders) or matching read-only SMS bar — glass */}
      <footer className="pointer-events-none sticky bottom-0 px-3 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2">
        {canReply ? (
          <form onSubmit={sendReply} className="pointer-events-auto flex items-center gap-2">
            <span className="msg-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <div className="msg-glass flex flex-1 items-center rounded-full py-2 pl-4 pr-1.5">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Text Message"
                className="w-full bg-transparent text-[14px] text-[#111] outline-none placeholder:text-[#8e8e93]"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                aria-label="Send"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#007aff] disabled:opacity-0"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </div>
          </form>
        ) : (
          /* Visual match of the iOS SMS bar — intentionally non-interactive */
          <div className="pointer-events-auto flex items-center gap-2" aria-disabled title={`${thread?.name ?? 'These'} notifications are read-only`}>
            <span className="msg-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <div className="msg-glass flex flex-1 items-center justify-between rounded-full py-[10px] pl-4 pr-3.5">
              <span className="text-[14px] text-[#8e8e93]">Text Message · SMS</span>
              <svg width="15" height="13" viewBox="0 0 22 16" fill="#8e8e93" className="shrink-0">
                <rect x="0" y="5" width="2.4" height="6" rx="1.2" />
                <rect x="4.8" y="2" width="2.4" height="12" rx="1.2" />
                <rect x="9.6" y="0" width="2.4" height="16" rx="1.2" />
                <rect x="14.4" y="3" width="2.4" height="10" rx="1.2" />
                <rect x="19.2" y="6" width="2.4" height="4" rx="1.2" />
              </svg>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
