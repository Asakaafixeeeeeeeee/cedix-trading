import { requireElevatedAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

export async function GET(req: Request) {
  return api(async () => {
    await requireElevatedAdmin();
    const url = new URL(req.url);
    const q = url.searchParams.get('q') ?? '';
    const action = url.searchParams.get('action') ?? '';
    const logs = await prisma.auditLog.findMany({
      where: {
        ...(action ? { action: { startsWith: action } } : {}),
        ...(q
          ? {
              OR: [
                { action: { contains: q, mode: 'insensitive' } },
                { targetId: { contains: q } },
                { admin: { username: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: { admin: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    return { logs };
  });
}
