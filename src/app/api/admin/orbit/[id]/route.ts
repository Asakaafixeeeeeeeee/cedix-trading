import { requireElevatedAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

/** Admin: set a post's status (restore / flag / remove). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const admin = await requireElevatedAdmin();
    const { id } = await ctx.params;
    const { status } = await req.json();
    if (!['ACTIVE', 'FLAGGED', 'REMOVED'].includes(status)) throw new Error('Invalid status');
    const post = await prisma.orbitPost.update({ where: { id }, data: { status } });
    await prisma.auditLog.create({
      data: { adminId: admin.id, action: `orbit.post.${String(status).toLowerCase()}`, targetType: 'POST', targetId: id },
    });
    return { post };
  });
}
