import { requireElevatedAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

export async function GET(req: Request) {
  return api(async () => {
    await requireElevatedAdmin();
    const url = new URL(req.url);
    const status = url.searchParams.get('status') ?? undefined;
    const posts = await prisma.orbitPost.findMany({
      where: status ? { status: status as never } : {},
      include: { author: { select: { username: true, email: true, orbitBanned: true, riskScore: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { posts };
  });
}
