'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Human-friendly message for a non-JSON / error HTTP response. Never leaks
 * raw parser errors like: Unexpected token '<', "<!DOCTYPE "... */
export function friendlyHttpError(status: number): string {
  if (status === 401 || status === 403) return 'Your session has expired. Please sign in again.';
  if (status === 404) return 'That action is unavailable. Please refresh and try again.';
  if (status === 408 || status === 504) return 'The request timed out. Please try again.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status === 502 || status === 503) return 'The service is temporarily unavailable (a deploy may be in progress). Please try again in a moment.';
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  if (status === 0) return 'Network error. Please check your connection and try again.';
  return 'Request failed. Please try again.';
}

/** Parse a fetch Response safely: tolerate HTML/empty bodies without throwing a
 * raw "Unexpected token '<'" — returns parsed JSON or throws a friendly error. */
export async function parseResponse<T = unknown>(res: Response): Promise<T> {
  const ct = res.headers.get('content-type') || '';
  const text = await res.text().catch(() => '');
  if (ct.includes('application/json')) {
    let json: Record<string, unknown> = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(res.ok ? 'Unexpected server response. Please try again.' : friendlyHttpError(res.status));
    }
    if (!res.ok) throw new Error((json.error as string) || friendlyHttpError(res.status));
    return json as T;
  }
  // Non-JSON body (HTML error page from the proxy, a redirect, empty, etc.)
  throw new Error(res.ok ? 'Unexpected server response. Please try again.' : friendlyHttpError(res.status));
}

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
      const json = await parseResponse<T>(res);
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
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(friendlyHttpError(0));
  }
  return parseResponse<T>(res);
}
