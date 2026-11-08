import { requireElevatedAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

export async function GET(req: Request) {
  return api(async () => {
    await requireElevatedAdmin();
    const url = new URL(req.url);
    const q = url.searchParams.get('q') ?? '';
    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { username: { contains: q, mode: 'insensitive' } },
              { displayName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {},
      select: {
        id: true, email: true, username: true, displayName: true, role: true, status: true,
        kycLevel: true, orbitBanned: true, riskScore: true, createdAt: true, lastLoginAt: true,
        wallets: { select: { asset: true, available: true, locked: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { users };
  });
}
