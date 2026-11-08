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
      {children}
    </div>
  );
}
