import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

export async function GET(req: Request) {
  return api(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const take = Math.min(100, parseInt(url.searchParams.get('limit') ?? '50', 10));
    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return { transactions };
  });
}
