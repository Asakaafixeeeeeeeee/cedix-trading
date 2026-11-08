import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

export async function GET() {
  return api(async () => {
    const user = await requireUser();
    const favorites = await prisma.favorite.findMany({ where: { userId: user.id } });
    return { favorites: favorites.map((f) => f.symbol) };
  });
}

export async function POST(req: Request) {
  return api(async () => {
    const user = await requireUser();
    const { symbol } = await req.json();
    if (!symbol) throw new Error('symbol required');
    const existing = await prisma.favorite.findUnique({
      where: { userId_symbol: { userId: user.id, symbol } },
    });
    if (existing) {
      await prisma.favorite.delete({ where: { userId_symbol: { userId: user.id, symbol } } });
      return { favorite: false };
    }
    await prisma.favorite.create({ data: { userId: user.id, symbol } });
    return { favorite: true };
  });
}
