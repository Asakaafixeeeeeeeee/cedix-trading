import { NextResponse } from 'next/server';
import { AuthError } from './auth';

type Handler<T> = () => Promise<T>;

/** Wraps an API handler: returns JSON, maps errors to proper status codes. */
export async function api<T>(fn: Handler<T>): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json(data as object);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
