import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { accruePosition } from '@/lib/earn';
import { api } from '@/lib/api';

export async function GET() {
  return api(async () => {
    const user = await requireUser();
    const active = await prisma.position.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      select: { id: true },
    });
    for (const p of active) await accruePosition(p.id);
    const positions = await prisma.position.findMany({
      where: { userId: user.id },
      include: { product: true },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    return { positions };
  });
}
