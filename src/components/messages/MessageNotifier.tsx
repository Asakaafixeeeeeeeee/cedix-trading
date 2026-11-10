'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { jfetch, ConversationAvatar, type SenderInfo } from './shared';

type Conversation = {
  id: string;
  name: string;
  sender: SenderInfo;
  last: { title: string | null; body: string; createdAt: string } | null;
  unread: number;
};

/**
 * iOS-style in-app notification banner. Watches the Messages inbox and, when a
 * new incoming message arrives, slides a frosted-glass banner down from the
 * top — like a real phone notification. It shows a truncated preview; tapping
 * opens the conversation to read the full text. Auto-dismisses after 5s or on
 * swipe-up.
 */
export default function MessageNotifier() {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const [banner, setBanner] = useState<{ convId: string; title: string; body: string } | null>(null);
  const [sender, setSender] = useState<SenderInfo>(null);
  const seen = useRef<Map<string, string>>(new Map()); // convId -> last message createdAt
  const primed = useRef(false);

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const d = await jfetch<{ conversations: Conversation[] }>('/api/messages/conversations');
        if (stop) return;
        // First pass only records current state (don't banner historical messages).
        if (!primed.current) {
          for (const c of d.conversations) if (c.last) seen.current.set(c.id, c.last.createdAt);
          primed.current = true;
          return;
        }
        // Find the newest conversation with a message we haven't shown yet.
        for (const c of d.conversations) {
          if (!c.last) continue;
          const prev = seen.current.get(c.id);
          if (prev !== c.last.createdAt && c.unread > 0) {
            seen.current.set(c.id, c.last.createdAt);
            // Don't banner the conversation the user is already reading.
            if (pathRef.current?.includes(`/messages/t/${c.id}`)) break;
            setSender(c.sender);
            setBanner({ convId: c.id, title: c.name, body: c.last.title ? `${c.last.title} ${c.last.body}` : c.last.body });
            break;
          }
          seen.current.set(c.id, c.last.createdAt);
        }
      } catch {
        /* ignore — not logged in / offline */
      }
    }
    poll();
    const t = setInterval(poll, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  if (!banner) return null;
  return (
    <NotificationBanner
      title={banner.title}
      body={banner.body}
      sender={sender}
      onOpen={() => {
        const id = banner.convId;
        setBanner(null);
        router.push(`/messages/t/${id}`);
      }}
      onDismiss={() => setBanner(null)}
    />
  );
}

export function NotificationBanner({
  title,
  body,
  sender,
  onOpen,
  onDismiss,
  autoDismissMs = 5000,
}: {
  title: string;
  body: string;
  sender: SenderInfo;
  onOpen: () => void;
  onDismiss: () => void;
  autoDismissMs?: number;
}) {
  const [leaving, setLeaving] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  const dismiss = () => {
    setLeaving(true);
    setTimeout(onDismiss, 220);
  };

  // Auto-dismiss after the configured duration (default 5 seconds).
  useEffect(() => {
    if (autoDismissMs <= 0) return;
    const t = setTimeout(dismiss, autoDismissMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-2.5 pt-[calc(8px+env(safe-area-inset-top))]">
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => e.key === 'Enter' && onOpen()}
        onTouchStart={(e) => (startY.current = e.touches[0].clientY)}
        onTouchMove={(e) => {
          if (startY.current === null) return;
          const dy = e.touches[0].clientY - startY.current;
          if (dy < 0) setDragY(dy); // only track upward swipe
        }}
        onTouchEnd={() => {
          if (dragY < -40) dismiss();
          else setDragY(0);
          startY.current = null;
        }}
        className="msg-notif pointer-events-auto w-full max-w-md cursor-pointer select-none rounded-[22px] px-3 py-3"
        style={{
          transform: `translateY(${leaving ? -140 : dragY}px)`,
          opacity: leaving ? 0 : 1,
          transition: startY.current === null ? 'transform .22s cubic-bezier(.2,.8,.25,1), opacity .22s ease' : 'none',
        }}
      >
        <div className="flex items-start gap-2.5">
          {/* Profile icon with small message badge overlay */}
          <div className="relative shrink-0">
            <ConversationAvatar sender={sender} size={38} />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-[17px] w-[17px] items-center justify-center rounded-full bg-[#34c759] ring-2 ring-white/70">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff">
                <path d="M12 3C6.5 3 2 6.6 2 11c0 2.2 1.1 4.2 2.9 5.6-.2 1-.6 1.9-1.3 2.6-.2.2 0 .6.3.5 1.5-.2 2.8-.7 3.7-1.5.8.2 1.6.3 2.4.3 5.5 0 10-3.6 10-8S17.5 3 12 3z" />
              </svg>
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="msg-name truncate text-[15px] font-bold text-[#1c1c1e]">{title}</span>
              <span className="shrink-0 text-[12px] text-[#6b6b70]">now</span>
            </div>
            {/* Truncated preview — clamps to 2 lines with an ellipsis */}
            <p className="mt-0.5 text-[14px] leading-snug text-[#2a2a2e] [display:-webkit-box] [overflow:hidden] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
              {body}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
