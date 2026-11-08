import { requireElevatedAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

export async function GET() {
  return api(async () => {
    await requireElevatedAdmin();
    const rows = await prisma.setting.findMany();
    const settings: Record<string, unknown> = {};
    for (const r of rows) settings[r.key] = r.value;
    return { settings };
  });
}

/** Admin: update platform settings (FX override/margin, fees, Payteller config). */
export async function PATCH(req: Request) {
  return api(async () => {
    const admin = await requireElevatedAdmin();
    const body = await req.json();
    const allowed = ['fx_margin_pct', 'fx_override', 'trading_fee_pct', 'withdrawal_fee_pct', 'payteller'];
    const updated: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) {
        await prisma.setting.upsert({
          where: { key },
          update: { value: body[key] === null ? { __null: true } : body[key] },
          create: { key, value: body[key] === null ? { __null: true } : body[key] },
        });
        // store plain null as JSON null
        if (body[key] === null) {
          await prisma.$executeRaw`UPDATE "Setting" SET value = 'null'::jsonb WHERE key = ${key}`;
        }
        updated[key] = body[key];
      }
    }
    if (Object.keys(updated).length === 0) throw new Error('No valid settings provided');
    await prisma.auditLog.create({
      data: { adminId: admin.id, action: 'settings.update', meta: updated as object },
    });
    return { ok: true, updated };
  });
}
