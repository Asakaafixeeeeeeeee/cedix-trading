'use client';
import { useEffect, useState } from 'react';
import { CONTENT, type ContentKey } from './content-defaults';

let cachedMap: Record<string, string> | null = null;
let inflight: Promise<Record<string, string>> | null = null;

async function loadContent(): Promise<Record<string, string>> {
  if (cachedMap) return cachedMap;
  if (!inflight) {
    inflight = fetch('/api/content')
      .then((r) => r.json())
      .then((d) => {
        cachedMap = d.content ?? {};
        return cachedMap!;
      })
      .catch(() => ({}))
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * Client hook for admin-editable copy. Returns a `t(key)` function that resolves
 * the current text (admin override or built-in default). Defaults render
 * immediately (no flash) and are replaced once the live map loads.
 */
export function useContent() {
  const [map, setMap] = useState<Record<string, string>>(cachedMap ?? {});
  useEffect(() => {
    let on = true;
    loadContent().then((m) => on && setMap(m));
    return () => {
      on = false;
    };
  }, []);
  function t(key: ContentKey, fallback?: string): string {
    return map[key] ?? fallback ?? CONTENT[key]?.default ?? '';
  }
  return { t };
}
