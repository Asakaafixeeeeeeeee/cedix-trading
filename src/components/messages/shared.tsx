'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export function iosTime(d: string | Date) {
  const date = new Date(d);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  const yest = new Date(now.getTime() - 86400000);
  if (date.toDateString() === yest.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
}

export function iosFullTime(d: string | Date) {
  const date = new Date(d);
  const now = new Date();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return time;
  const yest = new Date(now.getTime() - 86400000);
  if (date.toDateString() === yest.toDateString()) return `Yesterday ${time}`;
  return `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`;
}

export async function jfetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

/** Green CediX system avatar (matches the app icon). */
export function SystemAvatar({ size = 44 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: 'linear-gradient(180deg,#6BE56B,#14C32B)' }}
    >
      <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="#fff">
        <path d="M12 4c-4.9 0-9 3.2-9 7.3 0 2.3 1.3 4.4 3.4 5.7-.2 1.2-.7 2.3-1.5 3.2-.2.2 0 .5.3.5 2-.2 3.7-.9 4.9-1.9.9.2 1.9.3 2.9.3 4.9 0 9-3.2 9-7.3S16.9 4 12 4z" />
      </svg>
    </span>
  );
}

/**
 * iOS contact avatar: blue-to-purple gradient circle with either the default
 * white human silhouette or a white initial letter — exactly like Apple
 * Messages. Admin controls which type each sender uses.
 */
export function IosAvatar({ letter, size = 45 }: { letter?: string | null; size?: number }) {
  const id = `iosav-${size}-${letter ? 'l' : 'h'}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b7c2da" />
          <stop offset="1" stopColor="#8e96c9" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#${id})`} />
      {letter ? (
        <text
          x="50"
          y="51"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          fontSize="44"
          fontWeight="600"
          fontFamily="-apple-system, 'SF Pro Rounded', 'Segoe UI', system-ui, sans-serif"
        >
          {letter.slice(0, 1).toUpperCase()}
        </text>
      ) : (
        <g fill="#ffffff">
          <circle cx="50" cy="38" r="16.5" />
          <path d="M50 58c-16.8 0-28.5 9.6-31.5 22.6A49.8 49.8 0 0 0 50 100a49.8 49.8 0 0 0 31.5-19.4C78.5 67.6 66.8 58 50 58z" />
        </g>
      )}
    </svg>
  );
}

export type SenderInfo = { name: string; avatarType: string; letter: string | null; allowReplies?: boolean } | null;

/** Avatar for a conversation based on its admin-configured sender. */
export function ConversationAvatar({ sender, size = 45 }: { sender: SenderInfo; size?: number }) {
  if (sender?.avatarType === 'LETTER') {
    return <IosAvatar letter={sender.letter || sender.name} size={size} />;
  }
  return <IosAvatar size={size} />;
}

/** Returns true when running as an installed (standalone) PWA. */
export function useStandalone() {
  const [standalone, setStandalone] = useState(true); // assume true during SSR to avoid banner flash
  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true);
  }, []);
  return standalone;
}

/** Push notification state + enable action for the Messages SW registration. */
export function usePush() {
  const [state, setState] = useState<'unsupported' | 'prompt' | 'granted' | 'denied' | 'subscribed'>('unsupported');

  useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
      const reg = await navigator.serviceWorker.getRegistration('/messages/');
      if (!reg) return; // SW not registered (e.g. localhost)
      if (Notification.permission === 'denied') return setState('denied');
      const sub = await reg.pushManager.getSubscription();
      if (sub && Notification.permission === 'granted') return setState('subscribed');
      setState(Notification.permission === 'granted' ? 'granted' : 'prompt');
    })().catch(() => {});
  }, []);

  const enable = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration('/messages/');
    if (!reg) throw new Error('Notifications need the installed app');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      setState('denied');
      return false;
    }
    const { publicKey } = await jfetch<{ publicKey: string }>('/api/messages/push/key');
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
    await jfetch('/api/messages/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }),
    });
    setState('subscribed');
    return true;
  }, []);

  return { state, enable };
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Redirects to the activation notice when the device has no Messages session. */
export function useMessagesUser() {
  const router = useRouter();
  const [user, setUser] = useState<{ displayName: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    jfetch<{ user: { displayName: string; email: string } | null }>('/api/messages/auth/me')
      .then((d) => {
        if (!d.user) router.replace('/messages/welcome');
        else setUser(d.user);
      })
      .catch(() => router.replace('/messages/welcome'))
      .finally(() => setLoading(false));
  }, [router]);

  return { user, loading };
}
