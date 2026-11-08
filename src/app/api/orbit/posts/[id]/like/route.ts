import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const existing = await prisma.orbitLike.findUnique({
      where: { postId_userId: { postId: id, userId: user.id } },
    });
    if (existing) {
      await prisma.$transaction([
        prisma.orbitLike.delete({ where: { postId_userId: { postId: id, userId: user.id } } }),
        prisma.orbitPost.update({ where: { id }, data: { likeCount: { decrement: 1 } } }),
      ]);
      return { liked: false };
    }
    await prisma.$transaction([
      prisma.orbitLike.create({ data: { postId: id, userId: user.id } }),
      prisma.orbitPost.update({ where: { id }, data: { likeCount: { increment: 1 } } }),
    ]);
    return { liked: true };
  });
}
