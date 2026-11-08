import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

/** Published announcements (pinned first, newest first). */
export async function GET(req: Request) {
  return api(async () => {
    const url = new URL(req.url);
    const limit = Math.min(50, parseInt(url.searchParams.get('limit') ?? '20', 10));
    const announcements = await prisma.announcement.findMany({
      where: { published: true, publishAt: { lte: new Date() } },
      orderBy: [{ pinned: 'desc' }, { publishAt: 'desc' }],
      take: limit,
      select: { id: true, title: true, body: true, pinned: true, publishAt: true },
    });
    return { announcements };
  });
}
