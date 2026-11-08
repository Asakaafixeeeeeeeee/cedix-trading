import { getCurrentUser, requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

export async function GET(req: Request) {
  return api(async () => {
    const url = new URL(req.url);
    const side = url.searchParams.get('side') === 'BUY' ? 'BUY' : 'SELL';
    const asset = url.searchParams.get('asset') ?? undefined;
    const me = await getCurrentUser();
    const offers = await prisma.p2POffer.findMany({
      where: { active: true, side, ...(asset ? { asset } : {}) },
      include: { user: { select: { id: true, username: true, displayName: true, kycLevel: true, createdAt: true } } },
      orderBy: side === 'SELL' ? { priceGHS: 'asc' } : { priceGHS: 'desc' },
      take: 50,
    });
    return { offers, myId: me?.id ?? null };
  });
}

export async function POST(req: Request) {
  return api(async () => {
    const user = await requireUser();
    const { side, asset, priceGHS, minGHS, maxGHS, available, paymentMethods, terms } = await req.json();
    if (!['BUY', 'SELL'].includes(side)) throw new Error('side must be BUY or SELL');
    if (!asset || !(Number(priceGHS) > 0) || !(Number(available) > 0)) throw new Error('Invalid offer');
    const offer = await prisma.p2POffer.create({
      data: {
        userId: user.id,
        side,
        asset,
        priceGHS: Number(priceGHS),
        minGHS: Number(minGHS) || 10,
        maxGHS: Number(maxGHS) || 100000,
        available: Number(available),
        paymentMethods: Array.isArray(paymentMethods) ? paymentMethods : ['MTN MoMo'],
        terms: terms || null,
      },
    });
    return { offer };
  });
}
