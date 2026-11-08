// PAYTELLER payment gateway integration (https://paytelller.com — official docs
// at /docs.html). Runs in sandbox mode until live credentials are configured via
// Render environment variables:
//
//   PAYTELLER_API_BASE_URL   e.g. https://paytelller.com/api/v1  (non-secret)
//   PAYTELLER_MERCHANT_ID    e.g. TTM-44546097                   (non-secret)
//   PAYTELLER_USERNAME       e.g. pt_ttm-44546097                (non-secret)
//   PAYTELLER_API_KEY        live API key                        (SECRET)
//   PAYTELLER_WEBHOOK_SECRET webhook signing secret              (SECRET)
//
// Secrets must only ever live in server environment variables — never in code,
// the browser, logs or the database.

import { createHmac, timingSafeEqual } from 'node:crypto';

export type PaytellerMethod = 'MOMO' | 'CARD' | 'BANK';

/** Payment record shape returned by Payteller create/status/verify endpoints. */
export type PaytellerPayment = {
  id: string;
  reference: string;
  environment: string;
  /** pending | processing | successful | success | failed */
  status: string;
  currency: string;
  amount: string; // decimal GHS string, e.g. "100.00"
  merchant_net?: string;
  platform_commission?: string;
  checkout_url?: string;
  expires_at?: string;
  transaction_id?: string;
  provider_reference?: string;
  payment_method?: string;
  created_at?: string;
  completed_at?: string | null;
};

export type PaytellerWebhookEvent = {
  id: string;
  type: string; // payment.successful | payment.failed
  created_at: string;
  data: {
    id: string;
    merchant_id: string;
    reference: string;
    merchant_reference?: string;
    status: string;
    payment_method?: string;
    environment: string;
    currency: string;
    amount: string;
    merchant_net?: string;
    platform_commission?: string;
    provider_reference?: string;
    completed_at?: string;
  };
};

function env(name: string, fallback?: string) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

export function paytellerConfig() {
  return {
    baseUrl: (env('PAYTELLER_API_BASE_URL') ?? env('PAYTELLER_BASE_URL') ?? 'https://paytelller.com/api/v1').replace(/\/$/, ''),
    merchantId: env('PAYTELLER_MERCHANT_ID'),
    username: env('PAYTELLER_USERNAME'),
    apiKey: env('PAYTELLER_API_KEY'),
    passcode: env('PAYTELLER_PASSCODE'),
    webhookSecret: env('PAYTELLER_WEBHOOK_SECRET'),
    /** Environment we expect Payteller events/payments to carry. */
    expectedEnvironment: env('PAYTELLER_ENV', 'live')!,
  };
}

/** Live when the three primary credentials are configured. */
export function paytellerMode(): 'live' | 'sandbox' {
  const c = paytellerConfig();
  return c.apiKey && c.merchantId && c.username ? 'live' : 'sandbox';
}

/** Official authentication headers (docs §01). */
function ptHeaders(): Record<string, string> {
  const c = paytellerConfig();
  const h: Record<string, string> = {
    Authorization: `Bearer ${c.apiKey}`,
    'X-Payteller-Merchant-ID': c.merchantId ?? '',
    'X-Payteller-Username': c.username ?? '',
    'Content-Type': 'application/json',
  };
  if (c.passcode) h['X-Payteller-Passcode'] = c.passcode;
  return h;
}

async function ptFetch(path: string, init?: RequestInit): Promise<{ status: number; body: Record<string, unknown> }> {
  const c = paytellerConfig();
  const res = await fetch(`${c.baseUrl}${path}`, {
    ...init,
    headers: { ...ptHeaders(), ...(init?.headers as Record<string, string> | undefined) },
    signal: AbortSignal.timeout(20000),
  });
  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    // non-JSON error body
  }
  return { status: res.status, body };
}

/** GET /auth — checks credentials without creating a payment (docs §01). */
export async function testCredentials(): Promise<{ ok: boolean; status: number; detail: string }> {
  if (paytellerMode() !== 'live') return { ok: false, status: 0, detail: 'Live credentials not configured — sandbox mode.' };
  const { status, body } = await ptFetch('/auth');
  if (status === 200 && body.authenticated === true) {
    return { ok: true, status, detail: `Authenticated as ${body.merchant_id} (${body.environment})` };
  }
  return { ok: false, status, detail: String(body.error ?? `HTTP ${status}`) };
}

export type CreatePaymentRequest = {
  /** Unique per merchant+environment; 3-100 letters/digits/underscores/hyphens. */
  reference: string;
  amountGHS: number;
  customerEmail: string;
  /** 2-250 chars, shown on the hosted checkout. */
  description: string;
  /** Public HTTPS URL the customer returns to after a recorded outcome. */
  returnUrl?: string;
};

export type CreatePaymentResponse = {
  /** Payteller payment id (uuid) — used later with /payments/verify/{id}. */
  gatewayRef: string;
  status: 'AWAITING_PAYMENT';
  /** Hosted checkout the user must visit. Treat as private; do not log. */
  checkoutUrl: string;
};

/** POST /payments — creates a payment + hosted checkout (docs §02). */
export async function createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResponse> {
  if (paytellerMode() === 'live') {
    const payload: Record<string, string> = {
      amount: req.amountGHS.toFixed(2), // decimal string, required by the API
      currency: 'GHS',
      reference: req.reference,
      customer_email: req.customerEmail,
      description: req.description.slice(0, 250),
    };
    if (req.returnUrl && req.returnUrl.startsWith('https://')) payload.return_url = req.returnUrl;

    const { status, body } = await ptFetch('/payments', { method: 'POST', body: JSON.stringify(payload) });
    if (status !== 201 && status !== 200) {
      throw new Error(`Payment could not be created (${String(body.error ?? `gateway HTTP ${status}`)})`);
    }
    const p = body as unknown as PaytellerPayment;
    if (!p.id || !p.checkout_url) throw new Error('Gateway returned an incomplete payment response');
    return { gatewayRef: p.id, status: 'AWAITING_PAYMENT', checkoutUrl: p.checkout_url };
  }

  // Sandbox: simulated hosted checkout inside the app; never moves real money.
  return {
    gatewayRef: `PT-SBX-${req.reference}`,
    status: 'AWAITING_PAYMENT',
    checkoutUrl: `/pay/sandbox/${encodeURIComponent(req.reference)}`,
  };
}

/**
 * GET /payments/verify/{transaction_id} — authoritative status by Payteller
 * payment id (docs §03). Reports success | failed | pending | processing.
 */
export async function verifyPayment(transactionId: string): Promise<PaytellerPayment | null> {
  if (paytellerMode() !== 'live') return null;
  const { status, body } = await ptFetch(`/payments/verify/${encodeURIComponent(transactionId)}`);
  if (status === 404) return null;
  if (status !== 200) throw new Error(`Payment verification failed (HTTP ${status})`);
  return body as unknown as PaytellerPayment;
}

/** GET /payments/{reference} — status by merchant reference (docs §03). */
export async function getPaymentByReference(reference: string): Promise<PaytellerPayment | null> {
  if (paytellerMode() !== 'live') return null;
  const { status, body } = await ptFetch(`/payments/${encodeURIComponent(reference)}`);
  if (status === 404) return null;
  if (status !== 200) throw new Error(`Payment lookup failed (HTTP ${status})`);
  return body as unknown as PaytellerPayment;
}

/**
 * Verify a webhook signature (docs §04).
 * Header: X-Payteller-Signature: t=UNIX_SECONDS,v1=HEX_HMAC_SHA256
 * Signed content is `${timestamp}.${rawBody}` — raw request bytes, unmodified.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = paytellerConfig().webhookSecret;
  if (!secret || !signatureHeader) return false;
  const match = /^t=(\d+),v1=([a-f0-9]{64})$/.exec(signatureHeader.trim());
  if (!match) return false;
  const timestamp = Number(match[1]);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody, 'utf8').digest();
  const supplied = Buffer.from(match[2], 'hex');
  return supplied.length === expected.length && timingSafeEqual(expected, supplied);
}

/** True when a Payteller status string means verified success. */
export function isSuccessStatus(status: string | undefined): boolean {
  return status === 'success' || status === 'successful';
}

// ───────────────────────── Payouts (withdrawals) ─────────────────────────

export type PayoutRequest = {
  reference: string;
  amountGHS: number;
  method: PaytellerMethod;
  destination: string; // MoMo number or bank account
  destName?: string;
  description: string;
};

export type PayoutResponse = {
  gatewayRef: string;
  status: 'PROCESSING' | 'COMPLETED';
};

/**
 * Initiate a payout (platform pays GHS out → user MoMo/bank).
 *
 * Payteller has no automatic payout API — per its docs, merchant withdrawals
 * are requested in the Payteller dashboard and paid manually by an operator.
 * In live mode the withdrawal is therefore queued as PROCESSING for the CediX
 * admin to pay out and mark completed; funds are already debited and held.
 */
export async function createPayout(req: PayoutRequest): Promise<PayoutResponse> {
  if (paytellerMode() === 'live') {
    return { gatewayRef: `MANUAL-${req.reference}`, status: 'PROCESSING' };
  }
  // Sandbox: payouts complete instantly
  return { gatewayRef: `PT-SBX-${req.reference}`, status: 'COMPLETED' };
}
