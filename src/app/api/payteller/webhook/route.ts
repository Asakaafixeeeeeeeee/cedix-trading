import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { settleDeposit } from '@/lib/deposits';
import { paytellerMode } from '@/lib/payteller';

/**
 * SANDBOX-ONLY deposit confirmation, posted by the in-app simulated checkout
 * (/pay/sandbox/[ref]). Disabled entirely once live Payteller credentials are
 * configured — live payments are confirmed exclusively by the signed webhook
 * at /api/webhooks/payteller plus the authenticated verification API.
 */
export async function POST(req: Request) {
  if (paytellerMode() === 'live') {
    return NextResponse.json({ error: 'Sandbox checkout is disabled in live mode' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.reference) {
    return NextResponse.json({ error: 'reference required' }, { status: 400 });
  }

  const intent = await prisma.depositIntent.findUnique({ where: { id: body.reference } });
  if (!intent) return NextResponse.json({ error: 'unknown reference' }, { status: 404 });

  const success = body.status === 'success' || body.status === 'completed';
  const action = await settleDeposit(intent.id, success ? 'successful' : 'failed');
  return NextResponse.json({ ok: true, action });
}