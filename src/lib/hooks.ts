'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Minimal polling fetcher. */
export function usePoll<T>(url: string | null, intervalMs = 0): {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const urlRef = useRef(url);
  urlRef.current = url;

  const load = useCallback(async () => {
    const u = urlRef.current;
    if (!u) return;
    try {
      const res = await fetch(u, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || res.statusText);
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
    if (intervalMs > 0) {
      const t = setInterval(load, intervalMs);
      return () => clearInterval(t);
    }
  }, [url, intervalMs, load]);

  return { data, error, loading, refresh: load };
}

export type Me = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  kycLevel: number;
  orbitBanned: boolean;
} | null;

export function useUser() {
  const { data, loading, refresh } = usePoll<{ user: Me }>('/api/auth/me');
  return { user: data?.user ?? null, loading, refresh };
}

export async function post<T = unknown>(url: string, body?: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json as T;
}
