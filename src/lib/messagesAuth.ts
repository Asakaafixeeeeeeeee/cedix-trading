// Authentication for the separate Messages app (served under /messages).
// Uses its OWN session cookie — logging into CediX does not log a user into
// Messages and vice versa. Access is invite-only, granted by the CediX admin.

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './db';
import { AuthError } from './auth';
import type { MessagesAccount, User } from '@/generated/prisma/client';

const SECRET = new TextEncoder().encode((process.env.JWT_SECRET || 'dev-secret') + ':messages');
export const MESSAGES_COOKIE = 'cedix_msg_session';
// Like a real messaging app: once a device is activated through an admin
// invitation it stays signed in. Access is revoked instantly server-side when
// the admin suspends/disables the account (checked on every request).
const SESSION_DAYS = 365;

export async function setMessagesSession(userId: string) {
  const token = await new SignJWT({ app: 'messages' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(SECRET);
  const store = await cookies();
  store.set(MESSAGES_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: '/',
  });
}

export async function clearMessagesSession() {
  const store = await cookies();
  store.delete(MESSAGES_COOKIE);
}

export type MessagesUser = { user: User; account: MessagesAccount };

export async function getMessagesUser(): Promise<MessagesUser | null> {
  const store = await cookies();
  const token = store.get(MESSAGES_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.app !== 'messages' || !payload.sub) return null;
    const account = await prisma.messagesAccount.findUnique({
      where: { userId: payload.sub },
      include: { user: true },
    });
    if (!account || !account.registeredAt || account.suspended) return null;
    if (account.user.status === 'BLOCKED') return null;
    const { user, ...rest } = account;
    return { user, account: rest as MessagesAccount };
  } catch {
    return null;
  }
}

export async function requireMessagesUser(): Promise<MessagesUser> {
  const mu = await getMessagesUser();
  if (!mu) throw new AuthError('Not signed in', 401);
  return mu;
}
