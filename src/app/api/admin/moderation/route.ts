import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

export async function GET(req: Request) {
  return api(async () => {
    await requireAdmin();
    const url = new URL(req.url);
    const all = url.searchParams.get('all') === '1';
    const events = await prisma.moderationEvent.findMany({
      where: all ? {} : { resolved: false },
      include: { user: { select: { username: true, email: true, riskScore: true, orbitBanned: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { events };
  });
}
