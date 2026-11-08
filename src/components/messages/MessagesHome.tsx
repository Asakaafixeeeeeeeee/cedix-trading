'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { iosTime, jfetch, SystemAvatar, usePush, useStandalone, useMessagesUser } from './shared';

type Conversation = {
  id: string;
  name: string;
  system: boolean;
  last: { title: string | null; body: string; createdAt: string } | null;
  unread: number;
};

export default function MessagesHome() {
  const router = useRouter();
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

  async function signOut() {
    await jfetch('/api/messages/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/messages/login');
  }

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

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(76px+env(safe-area-inset-bottom))]">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-[#ffffff]/95 px-4 pt-[calc(10px+env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setEditMode((v) => !v)}
            className="rounded-full bg-[#f2f2f7] px-4 py-1.5 text-[14px] text-[#111]"
          >
            {editMode ? 'Done' : 'Edit'}
          </button>
          <button
            onClick={() => setFilterUnread((v) => !v)}
            aria-label="Filter"
            className={`relative flex h-9 w-9 items-center justify-center rounded-full ${filterUnread ? 'bg-[#007aff]' : 'bg-[#f2f2f7]'}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={filterUnread ? '#fff' : '#111'} strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            {filterUnread && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#34c759] ring-2 ring-[#fff]" />
            )}
          </button>
        </div>
        <h1 className="mt-2 pb-2 text-[31px] font-bold tracking-tight">Messages</h1>
      </header>

      {/* Edit mode: account actions */}
      {editMode && (
        <div className="mx-4 mb-2 overflow-hidden rounded-xl bg-[#f2f2f7]">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-[14px] font-medium">{user.displayName}</p>
              <p className="text-[12px] text-[#8e8e93]">{user.email}</p>
            </div>
            <button onClick={signOut} className="rounded-full bg-[#ff3b30] px-4 py-1.5 text-[13px] font-medium text-[#fff]">
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Enable notifications banner */}
      {pushState === 'prompt' || pushState === 'granted' ? (
        <div className="mx-4 mb-2 flex items-center gap-3 rounded-xl bg-[#f2f2f7] px-4 py-3">
          <SystemAvatar size={34} />
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
                <Link href={`/messages/t/${c.id}`} className="flex items-center gap-3 px-4 py-2 active:bg-[#f2f2f7]">
                  <span className="flex w-2.5 shrink-0 items-center justify-center">
                    {c.unread > 0 && <span className="h-2.5 w-2.5 rounded-full bg-[#007aff]" />}
                  </span>
                  <SystemAvatar />
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

      {/* Bottom search bar (iOS style) */}
      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-md bg-[#ffffff]/95 px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-full bg-[#f2f2f7] px-3.5 py-2">
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
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f2f2f7]" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
