'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { jfetch, type SenderInfo } from './shared';

/**
 * Notification-banner avatar — matches the iOS contact look exactly: a soft
 * blue-grey circle with a white person silhouette, and the green Messages app
 * icon (rounded square + white speech bubble) overlapping the bottom-right.
 * Drawn as SVG so it stays sharp at any size.
 */
function BannerAvatar({ size = 40 }: { size?: number }) {
  const badge = Math.round(size * 0.52);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
        <defs>
          <linearGradient id="bannerAvBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b7c2da" />
            <stop offset="1" stopColor="#8b95c4" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#bannerAvBg)" />
        <g fill="#ffffff">
          <circle cx="50" cy="39" r="17" />
          <path d="M50 60c-17.5 0-29.7 10-32.7 23.6A49.8 49.8 0 0 0 50 100a49.8 49.8 0 0 0 32.7-16.4C79.7 70 67.5 60 50 60z" />
        </g>
      </svg>
      {/* Green iMessage app icon badge, overlapping bottom-right */}
      <svg
        width={badge}
        height={badge}
        viewBox="0 0 100 100"
        className="absolute"
        style={{ right: -size * 0.08, bottom: -size * 0.04 }}
        aria-hidden
      >
        <defs>
          <linearGradient id="bannerMsgBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5BF675" />
            <stop offset="1" stopColor="#1FC24B" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="96" height="96" rx="26" fill="url(#bannerMsgBg)" stroke="#ffffff" strokeWidth="3" />
        <path
          d="M50 26c-15.2 0-27.5 9.9-27.5 22.1 0 6.9 3.9 13 10 17-.6 3.6-2.1 6.9-4.5 9.6-.6.7 0 1.7.9 1.5 5.9-1 10.3-3.4 13.2-5.6 2.5.7 5.2 1 7.9 1 15.2 0 27.5-9.9 27.5-22.1S65.2 26 50 26z"
          fill="#ffffff"
        />
      </svg>
    </div>
  );
}

/**
 * Play a short marimba-style two-note chime (synthesized with Web Audio —
 * not a copyrighted sound file) the instant the banner appears. Respects the
 * user's in-app sound toggle. Fails silently if audio is blocked.
 */
function playNoteChime() {
  try {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('cedix_msg_muted') === '1') return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    const notes = [
      { f: 1396.91, t: 0 }, // F6
      { f: 1864.66, t: 0.13 }, // A#6
    ];
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = n.f;
      gain.gain.setValueAtTime(0.0001, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.42, now + n.t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + 0.33);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + 0.38);
    }
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {
    /* audio unavailable/blocked — ignore */
  }
}

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
  onOpen,
  onDismiss,
  autoDismissMs = 5000,
}: {
  title: string;
  body: string;
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

  // Auto-dismiss after the configured duration (default 5 seconds), and play
  // the chime the instant the banner appears (simultaneous with the visual).
  useEffect(() => {
    playNoteChime();
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
          {/* Profile icon matching the iOS contact look (reference image) */}
          <BannerAvatar size={40} />
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
