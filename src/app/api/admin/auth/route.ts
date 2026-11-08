import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import {
  AuthError,
  getIp,
  hashPassword,
  requireElevatedAdmin,
  setElevationCookie,
  setSessionCookie,
  verifyPassword,
} from '@/lib/auth';
import { sendEmail, emailHtml } from '@/lib/email';

/**
 * Administrator authentication — email + password (replaces the 6-digit PIN).
 *
 * First-time setup (one time only): the current admin PIN proves authority,
 * then the administrator chooses their own password. No default password is
 * ever created; the hash is bcrypt and never leaves the server.
 */

const ADMIN_EMAIL = 'cedix1trading@gmail.com';
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

type GuardState = { failed: number; lockedUntil: number | null };

async function getGuard(): Promise<GuardState> {
  const row = await prisma.setting.findUnique({ where: { key: 'admin_auth_guard' } });
  const v = row?.value as GuardState | undefined;
  return { failed: v?.failed ?? 0, lockedUntil: v?.lockedUntil ?? null };
}

async function setGuard(state: GuardState) {
  await prisma.setting.upsert({
    where: { key: 'admin_auth_guard' },
    update: { value: state },
    create: { key: 'admin_auth_guard', value: state },
  });
}

async function isConfigured() {
  const row = await prisma.setting.findUnique({ where: { key: 'admin_auth_configured' } });
  return (row?.value as { configured?: boolean } | undefined)?.configured === true;
}

async function fail(adminId: string | null, ip: string | null, message: string) {
  const state = await getGuard();
  const failed = state.failed + 1;
  const lockedUntil = failed >= MAX_ATTEMPTS ? Date.now() + LOCK_MINUTES * 60000 : null;
  await setGuard({ failed: lockedUntil ? 0 : failed, lockedUntil });
  if (adminId) await prisma.auditLog.create({ data: { adminId, action: 'admin.auth.failed', ip } });
  return NextResponse.json(
    { error: lockedUntil ? `Too many failed attempts. Locked for ${LOCK_MINUTES} minutes.` : message },
    { status: 401 },
  );
}

/** Whether first-time password setup is still required. */
export async function GET() {
  return NextResponse.json({ configured: await isConfigured(), email: ADMIN_EMAIL });
}

export async function POST(req: Request) {
  try {
    const ip = getIp(req);
    const body = await req.json();
    const action = String(body.action ?? 'login');

    const guard = await getGuard();
    if (guard.lockedUntil && Date.now() < guard.lockedUntil) {
      const mins = Math.ceil((guard.lockedUntil - Date.now()) / 60000);
      return NextResponse.json({ error: `Too many failed attempts. Try again in ${mins} min.` }, { status: 429 });
    }

    // ── One-time secure setup: PIN proves authority, admin chooses password ──
    if (action === 'setup') {
      if (await isConfigured()) {
        return NextResponse.json({ error: 'Admin password is already configured — sign in instead.' }, { status: 409 });
      }
      const pin = String(body.pin ?? '');
      const password = String(body.password ?? '');
      if (password.length < 10) {
        return NextResponse.json({ error: 'Password must be at least 10 characters' }, { status: 400 });
      }
      const pinRow = await prisma.setting.findUnique({ where: { key: 'admin_pin_hash' } });
      const pinHash = typeof pinRow?.value === 'string' ? pinRow.value : null;
      if (!pinHash || !/^\d{6}$/.test(pin) || !(await bcrypt.compare(pin, pinHash))) {
        return fail(null, ip, 'Incorrect admin PIN');
      }

      const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
      if (!admin) return NextResponse.json({ error: 'No administrator account exists' }, { status: 500 });

      await prisma.$transaction([
        prisma.user.update({
          where: { id: admin.id },
          data: { email: ADMIN_EMAIL, passwordHash: await hashPassword(password) },
        }),
        prisma.setting.upsert({
          where: { key: 'admin_auth_configured' },
          update: { value: { configured: true, at: new Date().toISOString() } },
          create: { key: 'admin_auth_configured', value: { configured: true, at: new Date().toISOString() } },
        }),
        // Retire the PIN so it can never be used again
        prisma.setting.deleteMany({ where: { key: { in: ['admin_pin_hash', 'admin_pin_state'] } } }),
        prisma.auditLog.create({ data: { adminId: admin.id, action: 'admin.auth.password_setup', ip } }),
      ]);
      await setGuard({ failed: 0, lockedUntil: null });
      await setSessionCookie(admin.id, 'ADMIN');
      await setElevationCookie(admin.id);
      return NextResponse.json({ ok: true });
    }

    // ── Normal login: email + password ──
    if (!(await isConfigured())) {
      return NextResponse.json({ error: 'Admin password not configured yet' }, { status: 428 });
    }
    const email = String(body.email ?? '').toLowerCase().trim();
    const password = String(body.password ?? '');
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'ADMIN' || !(await verifyPassword(password, user.passwordHash))) {
      return fail(user?.role === 'ADMIN' ? user.id : null, ip, 'Invalid administrator email or password');
    }

    await setGuard({ failed: 0, lockedUntil: null });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await prisma.auditLog.create({ data: { adminId: user.id, action: 'admin.auth.login', ip } });
    await setSessionCookie(user.id, 'ADMIN');
    await setElevationCookie(user.id);

    // Security alert email (honest outbox — sends once Resend is connected)
    sendEmail({
      userId: user.id,
      to: user.email,
      subject: 'CediX Trading — Administrator sign-in alert',
      template: 'admin_login_alert',
      html: emailHtml('Administrator sign-in', [
        `A successful administrator sign-in just occurred.`,
        `Time: ${new Date().toUTCString()}`,
        `IP address: ${ip ?? 'unknown'}`,
        'If this was not you, change your password immediately from Admin → Settings.',
      ]),
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'Authentication failed' }, { status: 400 });
  }
}

/** Change the admin password (requires elevated session + current password). */
export async function PATCH(req: Request) {
  try {
    const admin = await requireElevatedAdmin();
    const { currentPassword, newPassword } = await req.json();
    if (typeof newPassword !== 'string' || newPassword.length < 10) {
      return NextResponse.json({ error: 'New password must be at least 10 characters' }, { status: 400 });
    }
    if (!(await verifyPassword(String(currentPassword ?? ''), admin.passwordHash))) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }
    await prisma.user.update({ where: { id: admin.id }, data: { passwordHash: await hashPassword(newPassword) } });
    await prisma.auditLog.create({ data: { adminId: admin.id, action: 'admin.auth.password_changed', ip: getIp(req) } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'Failed to change password' }, { status: 400 });
  }
}
