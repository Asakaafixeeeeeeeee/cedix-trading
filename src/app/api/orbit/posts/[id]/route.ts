import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const post = await prisma.orbitPost.findUnique({ where: { id } });
    if (!post) throw new Error('Post not found');
    if (post.authorId !== user.id && user.role !== 'ADMIN') throw new Error('Not allowed');
    await prisma.orbitPost.update({ where: { id }, data: { status: 'REMOVED' } });
    return { ok: true };
  });
}
