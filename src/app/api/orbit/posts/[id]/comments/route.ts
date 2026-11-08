import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { moderate } from '@/lib/moderation';
import { api } from '@/lib/api';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const { id } = await ctx.params;
    const comments = await prisma.orbitComment.findMany({
      where: { postId: id, status: 'ACTIVE' },
      include: { author: { select: { username: true, displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return { comments };
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const user = await requireUser();
    if (user.orbitBanned) throw new Error('You are blocked from posting in Orbit');
    const { id } = await ctx.params;
    const { content } = await req.json();
    const text = String(content ?? '').trim();
    if (!text) throw new Error('Comment is empty');
    if (text.length > 1000) throw new Error('Comment too long');

    const comment = await prisma.$transaction(async (db) => {
      const c = await db.orbitComment.create({
        data: { postId: id, authorId: user.id, content: text },
        include: { author: { select: { username: true, displayName: true, avatarUrl: true } } },
      });
      await db.orbitPost.update({ where: { id }, data: { commentCount: { increment: 1 } } });
      return c;
    });

    const result = await moderate('COMMENT', comment.id, user.id, text);
    if (result.action !== 'NONE') {
      await prisma.$transaction(async (db) => {
        await db.orbitComment.update({
          where: { id: comment.id },
          data: { status: result.action === 'FLAG' ? 'FLAGGED' : 'REMOVED', modScore: result.score },
        });
        await db.orbitPost.update({ where: { id }, data: { commentCount: { decrement: 1 } } });
      });
      throw new Error('Comment removed by AI moderation: ' + result.reasons.join('; '));
    }
    return { comment };
  });
}
