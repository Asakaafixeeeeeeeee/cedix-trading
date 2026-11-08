'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { iosTime, jfetch, ConversationAvatar, IosAvatar, usePush, useStandalone, useMessagesUser, type SenderInfo } from './shared';

type Conversation = {
  id: string;
  name: string;
  system: boolean;
  sender: SenderInfo;
  last: { title: string | null; body: string; createdAt: string } | null;
  unread: number;
};

export default function MessagesHome() {
  const { user, loading } = useMessagesUser();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [filterUnread, setFilterUnread] = useState(false);
  const [search, setSearch] = useState('');
  const [editMode, setEditMode] = useState(false);
  const standalone = useStandalone();
  const { state: pushState, enable: enablePush } = usePush();
  const [showInstall, setShowInstall] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let stop = false;
    async function load() {
      try {
        const d = await jfetch<{ conversations: Conversation[] }>('/api/messages/conversations');
        if (!stop) setConversations(d.conversations);
      } catch {
        /* retry next poll */
      }
    }
    load();
    const t = setInterval(load, 8000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#e5e5ea] border-t-[#9a9aa0]" />
      </div>
    );
  }

  const list = (conversations ?? [])
    .filter((c) => (filterUnread ? c.unread > 0 : true))
    .filter((c) => (search ? c.name.toLowerCase().includes(search.toLowerCase()) || (c.last?.body ?? '').toLowerCase().includes(search.toLowerCase()) : true));

  const totalUnread = (conversations ?? []).reduce((s, c) => s + c.unread, 0);

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(76px+env(safe-area-inset-bottom))]">
      {/* Top bar — Edit left, centred title, filter with blue unread badge */}
      <header className="sticky top-0 z-10 bg-[#ffffff]/95 px-4 pb-2 pt-[calc(10px+env(safe-area-inset-top))] backdrop-blur">
        <div className="grid grid-cols-[64px_1fr_64px] items-center">
          <button
            onClick={() => setEditMode((v) => !v)}
            className="justify-self-start rounded-full bg-[#f2f2f7] px-4 py-1.5 text-[14px] text-[#111]"
          >
            {editMode ? 'Done' : 'Edit'}
          </button>
          <h1 className="text-center text-[17px] font-semibold tracking-tight text-[#111]">Messages</h1>
          <span className="relative justify-self-end">
            <button
              onClick={() => setFilterUnread((v) => !v)}
              aria-label="Filter"
              className={`flex h-9 w-9 items-center justify-center rounded-full ${filterUnread ? 'bg-[#007aff]' : 'bg-[#f2f2f7]'}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={filterUnread ? '#fff' : '#111'} strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
            </button>
            {totalUnread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#007aff] px-1 text-[11px] font-semibold text-[#fff] ring-2 ring-[#fff]">
                {totalUnread}
              </span>
            )}
          </span>
        </div>
      </header>

      {/* Edit mode: account info */}
      {editMode && (
        <div className="mx-4 mb-2 overflow-hidden rounded-xl bg-[#f2f2f7]">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-[14px] font-medium">{user.displayName}</p>
              <p className="text-[12px] text-[#8e8e93]">{user.email}</p>
            </div>
            <span className="rounded-full bg-[#e5e5ea] px-3 py-1.5 text-[11px] font-medium text-[#48484a]">
              Activated device
            </span>
          </div>
        </div>
      )}

      {/* Enable notifications banner */}
      {pushState === 'prompt' || pushState === 'granted' ? (
        <div className="mx-4 mb-2 flex items-center gap-3 rounded-xl bg-[#f2f2f7] px-4 py-3">
          <IosAvatar size={34} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">Get notified instantly</p>
            <p className="text-[11px] leading-snug text-[#8e8e93]">Allow notifications to receive transaction alerts on this device.</p>
          </div>
          <button
            disabled={pushBusy}
            onClick={async () => {
              setPushBusy(true);
              try {
                await enablePush();
              } catch {
                /* denied or unsupported */
              } finally {
                setPushBusy(false);
              }
            }}
            className="shrink-0 rounded-full bg-[#007aff] px-3.5 py-1.5 text-[12px] font-semibold text-[#fff] disabled:opacity-50"
          >
            {pushBusy ? '…' : 'Enable'}
          </button>
        </div>
      ) : null}

      {/* Add to Home Screen banner (iPhone) */}
      {!standalone && (
        <div className="mx-4 mb-2 rounded-xl bg-[#f2f2f7] px-4 py-3">
          <button onClick={() => setShowInstall((v) => !v)} className="flex w-full items-center justify-between">
            <span className="text-[13px] font-medium">Install Messages on your phone</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2.5" strokeLinecap="round" className={showInstall ? 'rotate-90' : ''}>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
          {showInstall && (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[12px] leading-relaxed text-[#48484a]">
              <li>Open this page in <b>Safari</b> on your iPhone.</li>
              <li>Tap the <b>Share</b> button (square with an arrow).</li>
              <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
              <li>Tap <b>Add</b> — the green Messages icon appears on your Home Screen.</li>
              <li>Open it from the Home Screen and tap <b>Enable</b> above to turn on notifications.</li>
            </ol>
          )}
        </div>
      )}

      {/* Conversations */}
      <main className="flex-1">
        {conversations === null ? (
          <p className="px-4 py-10 text-center text-[13px] text-[#8e8e93]">Loading conversations…</p>
        ) : list.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-[#8e8e93]">
            {filterUnread ? 'No unread messages.' : 'No messages yet. Transaction notifications will appear here.'}
          </p>
        ) : (
          <ul>
            {list.map((c) => (
              <li key={c.id}>
                <Link href={`/messages/t/${c.id}`} className="flex items-center gap-3 py-2 pl-2.5 pr-4 active:bg-[#f2f2f7]">
                  <span className="flex w-2.5 shrink-0 items-center justify-center">
                    {c.unread > 0 && <span className="h-2.5 w-2.5 rounded-full bg-[#007aff]" />}
                  </span>
                  <ConversationAvatar sender={c.sender} />
                  <span className="flex min-w-0 flex-1 flex-col border-b border-[#e5e5ea] py-1.5">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[15px] font-semibold">{c.name}</span>
                      <span className="flex shrink-0 items-center gap-1 text-[12px] text-[#8e8e93]">
                        {c.last ? iosTime(c.last.createdAt) : ''}
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#c7c7cc" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </span>
                    </span>
                    <span className="line-clamp-2 text-[13px] leading-snug text-[#8e8e93]">
                      {c.last ? `${c.last.title ? c.last.title + ' — ' : ''}${c.last.body.split('\n')[0]}` : 'No messages yet'}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Bottom search bar + compose (iOS style) */}
      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-md bg-[#ffffff]/95 px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="flex flex-1 items-center gap-2 rounded-full bg-[#eeeef0] px-3.5 py-[7px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full bg-transparent text-[14px] outline-none placeholder:text-[#8e8e93]"
            />
            {/* Microphone (visual, per iOS reference) */}
            <svg width="13" height="16" viewBox="0 0 24 28" fill="none" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" className="shrink-0">
              <rect x="9" y="2" width="6" height="13" rx="3" />
              <path d="M5 13a7 7 0 0014 0M12 20v5M8.5 25h7" />
            </svg>
          </div>
          <button
            aria-label="Compose (read-only inbox)"
            title="CediX notifications are read-only"
            onClick={() => {}}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#eeeef0]"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#b9b9be" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-6" />
              <path d="M17.3 3.7a2.1 2.1 0 013 3L11 16l-4 1 1-4 9.3-9.3z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
