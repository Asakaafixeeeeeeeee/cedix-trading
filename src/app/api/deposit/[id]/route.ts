import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const deposit = await prisma.depositIntent.findUnique({ where: { id } });
    if (!deposit || deposit.userId !== user.id) throw new Error('Deposit not found');
    return { deposit };
  });
}
