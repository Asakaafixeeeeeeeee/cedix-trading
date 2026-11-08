import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { credit, debit } from '@/lib/wallet';
import { api } from '@/lib/api';

/** Admin: manually credit or debit a user's balance. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const { asset, amount, note } = await req.json();
    const amt = Number(amount);
    if (!asset || !amt || !isFinite(amt)) throw new Error('asset and non-zero amount required');

    await prisma.$transaction(async (db) => {
      if (amt > 0) await credit(db, id, asset, amt);
      else await debit(db, id, asset, -amt);
      await db.transaction.create({
        data: {
          userId: id,
          type: 'ADMIN_ADJUST',
          asset,
          amount: Math.abs(amt),
          note: note || `Admin ${amt > 0 ? 'credit' : 'debit'} by ${admin.username}`,
          meta: { adminId: admin.id, signed: amt },
        },
      });
      await db.auditLog.create({
        data: { adminId: admin.id, action: 'balance.adjust', targetType: 'USER', targetId: id, meta: { asset, amount: amt, note } },
      });
    });
    return { ok: true };
  });
}
