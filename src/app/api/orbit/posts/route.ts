import { getCurrentUser, requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { moderate } from '@/lib/moderation';
import { api } from '@/lib/api';

export async function GET(req: Request) {
  return api(async () => {
    const url = new URL(req.url);
    const cursor = url.searchParams.get('cursor');
    const me = await getCurrentUser();
    const posts = await prisma.orbitPost.findMany({
      where: { status: 'ACTIVE' },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true, kycLevel: true } },
        likes: me ? { where: { userId: me.id }, select: { userId: true } } : false,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return {
      posts: posts.map((p) => ({
        ...p,
        liked: me ? p.likes?.length > 0 : false,
        likes: undefined,
      })),
      nextCursor: posts.length === 20 ? posts[posts.length - 1].id : null,
      myId: me?.id ?? null,
    };
  });
}

export async function POST(req: Request) {
  return api(async () => {
    const user = await requireUser();
    if (user.orbitBanned) throw new Error('You are blocked from posting in Orbit');
    const { content, mediaUrls, mediaType } = await req.json();
    const text = String(content ?? '').trim();
    if (!text && !(Array.isArray(mediaUrls) && mediaUrls.length)) throw new Error('Post is empty');
    if (text.length > 4000) throw new Error('Post too long (max 4000 chars)');

    const post = await prisma.orbitPost.create({
      data: {
        authorId: user.id,
        content: text,
        mediaUrls: Array.isArray(mediaUrls) ? mediaUrls.slice(0, 4) : undefined,
        mediaType: mediaType === 'video' ? 'video' : mediaUrls?.length ? 'image' : null,
      },
    });

    // AI moderation
    const result = await moderate('POST', post.id, user.id, text);
    if (result.action === 'REMOVE' || result.action === 'BLOCK_USER') {
      await prisma.orbitPost.update({
        where: { id: post.id },
        data: { status: 'REMOVED', modScore: result.score, modReasons: result.reasons },
      });
      throw new Error(
        result.action === 'BLOCK_USER'
          ? 'Post removed and account blocked from Orbit for repeated fraud attempts.'
          : 'Post removed by AI moderation: ' + result.reasons.join('; '),
      );
    }
    if (result.action === 'FLAG') {
      await prisma.orbitPost.update({
        where: { id: post.id },
        data: { status: 'FLAGGED', modScore: result.score, modReasons: result.reasons },
      });
      return { post: null, flagged: true, message: 'Your post is under review by our moderation team.' };
    }
    return { post };
  });
}
