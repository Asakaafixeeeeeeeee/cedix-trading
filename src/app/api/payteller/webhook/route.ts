import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { credit } from '@/lib/wallet';
import { paytellerMode } from '@/lib/payteller';

/**
 * Payteller webhook: confirms collections (deposits).
 * In sandbox mode the in-app sandbox checkout posts here.
 * In live mode, requests are verified against the configured API key.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.reference) {
    return NextResponse.json({ error: 'reference required' }, { status: 400 });
  }

  if (paytellerMode() === 'live') {
    const auth = req.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${process.env.PAYTELLER_API_KEY}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const intent = await prisma.depositIntent.findUnique({ where: { id: body.reference } });
  if (!intent) return NextResponse.json({ error: 'unknown reference' }, { status: 404 });
  if (intent.status === 'COMPLETED') return NextResponse.json({ ok: true, already: true });

  const success = body.status === 'success' || body.status === 'completed';
  if (!success) {
    await prisma.depositIntent.update({
      where: { id: intent.id },
      data: { status: body.status === 'cancelled' ? 'CANCELLED' : 'FAILED' },
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.$transaction(async (db) => {
    await credit(db, intent.userId, intent.asset, Number(intent.amountAsset));
    await db.depositIntent.update({ where: { id: intent.id }, data: { status: 'COMPLETED' } });
    await db.transaction.create({
      data: {
        userId: intent.userId,
        type: 'DEPOSIT',
        asset: intent.asset,
        amount: intent.amountAsset,
        note: `Deposit GHS ${intent.amountGHS} → ${intent.asset} via Payteller (${intent.method})`,
        meta: { depositId: intent.id, amountGHS: Number(intent.amountGHS), rate: Number(intent.rateGHSUSD) },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
