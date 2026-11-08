import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

export async function GET() {
  return api(async () => {
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: [{ type: 'asc' }, { apy: 'desc' }],
    });
    return { products };
  });
}
