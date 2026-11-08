import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

/** Active promotional banners for the home page. */
export async function GET() {
  return api(async () => {
    const banners = await prisma.banner.findMany({
      where: { active: true },
      orderBy: { sort: 'asc' },
      take: 10,
    });
    return { banners };
  });
}
