'use client';
import { useEffect } from 'react';

/** Registers the PWA service worker (production only — disabled in dev to avoid stale chunks). */
export default function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (isLocal) {
      // Clean up any previously registered SW + caches that break dev HMR
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      if ('caches' in window) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      return;
    }
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
