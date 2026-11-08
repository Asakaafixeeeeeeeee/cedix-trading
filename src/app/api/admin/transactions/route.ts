import { requireElevatedAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

export async function GET(req: Request) {
  return api(async () => {
    await requireElevatedAdmin();
    const url = new URL(req.url);
    const type = url.searchParams.get('type') ?? undefined;
    const transactions = await prisma.transaction.findMany({
      where: type ? { type: type as never } : {},
      include: { user: { select: { username: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { transactions };
  });
}
