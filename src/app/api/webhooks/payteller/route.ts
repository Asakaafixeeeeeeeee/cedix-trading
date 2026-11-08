import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { settleDeposit } from '@/lib/deposits';
import {
  isSuccessStatus,
  paytellerConfig,
  paytellerMode,
  verifyPayment,
  verifyWebhookSignature,
  type PaytellerWebhookEvent,
} from '@/lib/payteller';

/**
 * PAYTELLER webhook receiver (live payments).
 *
 * Destination URL to configure in the Payteller dashboard:
 *   https://cedixtrading.com/api/webhooks/payteller
 *   (https://cedix.onrender.com/api/webhooks/payteller also remains valid)
 *
 * Security model (per Payteller docs §04):
 *  1. The X-Payteller-Signature header (t=timestamp,v1=hex) is verified as
 *     HMAC-SHA256 over `${timestamp}.${rawBody}` using the signing secret,
 *     with a 5-minute timestamp tolerance and constant-time comparison.
 *  2. Event ids are stored with a unique primary key — retried deliveries are
 *     acknowledged without repeating fulfillment.
 *  3. A `payment.successful` event is additionally confirmed through the
 *     authenticated GET /payments/verify/{transaction_id} API; merchant,
 *     reference, environment, currency and amount must all match our record.
 *  4. Crediting happens exactly once inside an atomic status-guarded database
 *     transaction (src/lib/deposits.ts). Browser redirects never credit.
 */
export async function POST(req: Request) {
  if (paytellerMode() !== 'live' || !paytellerConfig().webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  // Signature check MUST use the exact raw request bytes.
  const rawBody = await req.text();
  if (!verifyWebhookSignature(rawBody, req.headers.get('x-payteller-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: PaytellerWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!event?.id || !event?.type || !event?.data) {
    return NextResponse.json({ error: 'Malformed event' }, { status: 400 });
  }

  const cfg = paytellerConfig();
  const d = event.data;
  const reference = d.merchant_reference ?? d.reference;

  // Fast idempotency path: already durably recorded → acknowledge. Settlement
  // itself is also idempotent, so we still re-run it to heal any earlier
  // partial failure between recording and crediting.
  const seen = await prisma.webhookEvent.findUnique({ where: { id: event.id } });

  let action = 'ignored';
  if (
    (event.type === 'payment.successful' || event.type === 'payment.failed') &&
    d.merchant_id === cfg.merchantId &&
    d.environment === cfg.expectedEnvironment &&
    d.currency === 'GHS' &&
    reference
  ) {
    const intent = await prisma.depositIntent.findUnique({ where: { id: reference } });
    if (intent && Math.abs(Number(d.amount) - Number(intent.amountGHS)) < 0.005) {
      if (event.type === 'payment.successful') {
        // Never credit from the webhook body alone — confirm through the
        // authenticated verification API (docs §03).
        const verified = await verifyPayment(d.id);
        const ok =
          verified &&
          isSuccessStatus(verified.status) &&
          verified.reference === intent.id &&
          verified.currency === 'GHS' &&
          verified.environment === cfg.expectedEnvironment &&
          Math.abs(Number(verified.amount) - Number(intent.amountGHS)) < 0.005;
        if (!ok) {
          // Transient verification problems → 500 so Payteller retries later.
          if (!verified) return NextResponse.json({ error: 'Verification unavailable' }, { status: 500 });
          action = 'verification-mismatch';
        } else {
          action = await settleDeposit(intent.id, 'successful');
        }
      } else {
        action = await settleDeposit(intent.id, 'failed');
      }
    } else {
      action = intent ? 'amount-mismatch' : 'unknown-reference';
    }
  }

  // Durably record the event before acknowledging (unique id = dedupe).
  if (!seen) {
    await prisma.webhookEvent.create({
      data: {
        id: event.id,
        gateway: 'payteller',
        type: event.type,
        reference: reference ?? null,
        payload: JSON.parse(rawBody),
      },
    }).catch((e: unknown) => {
      // Unique violation from a concurrent delivery → safe to acknowledge.
      if (!(e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002')) throw e;
    });
  }

  return NextResponse.json({ received: true, action, duplicate: Boolean(seen) });
}
