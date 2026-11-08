'use client';
import { useEffect } from 'react';

/** Registers the PWA service worker for the mobile app. */
export default function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
