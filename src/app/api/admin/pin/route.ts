import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { requireAdmin, requireElevatedAdmin, setElevationCookie, getIp, AuthError } from '@/lib/auth';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

type PinState = { failed: number; lockedUntil: number | null };

async function getPinState(): Promise<PinState> {
  const row = await prisma.setting.findUnique({ where: { key: 'admin_pin_state' } });
  const v = row?.value as PinState | undefined;
  return { failed: v?.failed ?? 0, lockedUntil: v?.lockedUntil ?? null };
}

async function setPinState(state: PinState) {
  await prisma.setting.upsert({
    where: { key: 'admin_pin_state' },
    update: { value: state },
    create: { key: 'admin_pin_state', value: state },
  });
}

async function audit(adminId: string, action: string, ip: string | null, meta?: object) {
  await prisma.auditLog.create({ data: { adminId, action, ip, meta } });
}

/** Verify the admin PIN and grant a 30-minute elevated session. Rate limited. */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(); // must already be an authenticated ADMIN account
    const ip = getIp(req);
    const { pin } = await req.json();

    const state = await getPinState();
    if (state.lockedUntil && Date.now() < state.lockedUntil) {
      const mins = Math.ceil((state.lockedUntil - Date.now()) / 60000);
      await audit(admin.id, 'admin.pin.locked_attempt', ip);
      return NextResponse.json({ error: `Too many failed attempts. Try again in ${mins} min.` }, { status: 429 });
    }

    const row = await prisma.setting.findUnique({ where: { key: 'admin_pin_hash' } });
    const hash = typeof row?.value === 'string' ? row.value : null;
    if (!hash) return NextResponse.json({ error: 'Admin PIN is not configured' }, { status: 500 });

    const ok = typeof pin === 'string' && /^\d{6}$/.test(pin) && (await bcrypt.compare(pin, hash));
    if (!ok) {
      const failed = state.failed + 1;
      const lockedUntil = failed >= MAX_ATTEMPTS ? Date.now() + LOCK_MINUTES * 60000 : null;
      await setPinState({ failed: lockedUntil ? 0 : failed, lockedUntil });
      await audit(admin.id, 'admin.pin.failed', ip, { failed });
      return NextResponse.json(
        { error: lockedUntil ? `Too many failed attempts. Locked for ${LOCK_MINUTES} minutes.` : `Incorrect PIN (${MAX_ATTEMPTS - failed} attempts left)` },
        { status: 401 },
      );
    }

    await setPinState({ failed: 0, lockedUntil: null });
    await setElevationCookie(admin.id);
    await audit(admin.id, 'admin.pin.unlocked', ip);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'PIN verification failed' }, { status: 400 });
  }
}

/** Change the admin PIN (requires an elevated session). */
export async function PATCH(req: Request) {
  try {
    const admin = await requireElevatedAdmin();
    const { newPin } = await req.json();
    if (typeof newPin !== 'string' || !/^\d{6}$/.test(newPin)) {
      return NextResponse.json({ error: 'PIN must be exactly 6 digits' }, { status: 400 });
    }
    await prisma.setting.upsert({
      where: { key: 'admin_pin_hash' },
      update: { value: await bcrypt.hash(newPin, 10) },
      create: { key: 'admin_pin_hash', value: await bcrypt.hash(newPin, 10) },
    });
    await audit(admin.id, 'admin.pin.changed', getIp(req));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'Failed to change PIN' }, { status: 400 });
  }
}
