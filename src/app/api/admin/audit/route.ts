import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

export async function GET() {
  return api(async () => {
    await requireAdmin();
    const logs = await prisma.auditLog.findMany({
      include: { admin: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { logs };
  });
}
