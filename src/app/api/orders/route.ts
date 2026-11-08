import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { placeOrder } from '@/lib/trading';
import { api } from '@/lib/api';

export async function GET(req: Request) {
  return api(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const orders = await prisma.order.findMany({
      where: {
        userId: user.id,
        ...(status === 'open' ? { status: 'OPEN' } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { orders };
  });
}

export async function POST(req: Request) {
  return api(async () => {
    const user = await requireUser();
    const body = await req.json();
    const order = await placeOrder(user.id, {
      symbol: body.symbol,
      side: body.side === 'SELL' ? 'SELL' : 'BUY',
      type: body.type === 'LIMIT' ? 'LIMIT' : 'MARKET',
      price: body.price ? Number(body.price) : undefined,
      quantity: Number(body.quantity),
    });
    return { order };
  });
}
