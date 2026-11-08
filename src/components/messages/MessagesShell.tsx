'use client';
import { useEffect } from 'react';

/**
 * Shell for the Messages PWA:
 *  - forces light appearance (the Messages app is always white, per design),
 *  - registers the /messages service worker (push + installed-app behaviour).
 */
export default function MessagesShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
      navigator.serviceWorker.register('/messages/sw.js', { scope: '/messages/' }).catch(() => {});
    }
  }, []);

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-[#ffffff] text-[#111111]"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Apple-style Liquid Glass for floating controls (Safari-compatible). */}
      <style>{`
        .msg-glass{
          background:linear-gradient(180deg,rgba(255,255,255,.60),rgba(255,255,255,.38));
          -webkit-backdrop-filter:blur(18px) saturate(1.8);
          backdrop-filter:blur(18px) saturate(1.8);
          border:1px solid rgba(255,255,255,.55);
          box-shadow:
            inset 0 1.5px 1px rgba(255,255,255,.9),
            inset 0 -1px 1px rgba(0,0,0,.04),
            0 10px 28px rgba(0,0,0,.12),
            0 2px 6px rgba(0,0,0,.06);
        }
        .msg-glass-soft{
          background:linear-gradient(180deg,rgba(252,252,253,.72),rgba(248,248,250,.55));
          -webkit-backdrop-filter:blur(16px) saturate(1.7);
          backdrop-filter:blur(16px) saturate(1.7);
          border:1px solid rgba(255,255,255,.5);
          box-shadow:
            inset 0 1px 1px rgba(255,255,255,.85),
            0 6px 18px rgba(0,0,0,.08),
            0 1px 3px rgba(0,0,0,.05);
        }
      `}</style>
      {children}
    </div>
  );
}
