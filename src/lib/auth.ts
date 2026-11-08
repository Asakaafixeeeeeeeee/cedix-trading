import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { prisma } from './db';
import type { User } from '@/generated/prisma/client';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret');
export const SESSION_COOKIE = 'cedix_session';
const SESSION_DAYS = 7;

export type SessionPayload = { sub: string; role: string };

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(userId: string, role: string) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(SECRET);
}

export async function setSessionCookie(userId: string, role: string) {
  const token = await createSessionToken(userId, role);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: '/',
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return { sub: payload.sub as string, role: (payload.role as string) || 'USER' };
  } catch {
    return null;
  }
}

/** Returns the full user record for the current session, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user || user.status === 'BLOCKED') return null;
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('Not authenticated', 401);
  if (user.status === 'SUSPENDED') throw new AuthError('Account suspended', 403);
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new AuthError('Admin access required', 403);
  return user;
}

// ───────── Admin PIN elevation ─────────
// Admin APIs/dashboard require BOTH an authenticated ADMIN account and a
// short-lived elevation token obtained by entering the admin PIN.

export const ELEVATION_COOKIE = 'cedix_admin_elev';
const ELEVATION_MINUTES = 480; // 8h — granted by admin email+password login

export async function setElevationCookie(userId: string) {
  const token = await new SignJWT({ elev: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ELEVATION_MINUTES}m`)
    .sign(SECRET);
  const store = await cookies();
  store.set(ELEVATION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ELEVATION_MINUTES * 60,
    path: '/',
  });
}

export async function clearElevationCookie() {
  const store = await cookies();
  store.delete(ELEVATION_COOKIE);
}

export async function isElevated(userId: string): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ELEVATION_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload.sub === userId && payload.elev === true;
  } catch {
    return false;
  }
}

/** Admin role + active PIN elevation (for admin APIs and dashboard). */
export async function requireElevatedAdmin(): Promise<User> {
  const user = await requireAdmin();
  if (!(await isElevated(user.id))) throw new AuthError('Admin PIN required', 428);
  return user;
}

export function getIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}
