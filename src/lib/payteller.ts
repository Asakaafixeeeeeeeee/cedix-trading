// Payteller payment gateway integration.
// Runs in sandbox mode until PAYTELLER_API_KEY + PAYTELLER_BASE_URL are configured
// (set env vars, or configure via the admin dashboard → Settings → Payteller).

export type PaytellerMethod = 'MOMO' | 'CARD' | 'BANK';

export type CollectionRequest = {
  reference: string;
  amountGHS: number;
  method: PaytellerMethod;
  payerPhone?: string;
  description: string;
  callbackUrl: string;
};

export type CollectionResponse = {
  gatewayRef: string;
  status: 'AWAITING_PAYMENT';
  /** URL the user must visit to complete payment */
  checkoutUrl: string;
};

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

export function paytellerMode(): 'live' | 'sandbox' {
  return process.env.PAYTELLER_API_KEY && process.env.PAYTELLER_BASE_URL ? 'live' : 'sandbox';
}

/** Initiate a collection (user pays GHS in → platform). */
export async function createCollection(req: CollectionRequest): Promise<CollectionResponse> {
  if (paytellerMode() === 'live') {
    const res = await fetch(`${process.env.PAYTELLER_BASE_URL}/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.PAYTELLER_API_KEY}`,
      },
      body: JSON.stringify({
        merchant_id: process.env.PAYTELLER_MERCHANT_ID,
        reference: req.reference,
        amount: req.amountGHS,
        currency: 'GHS',
        channel: req.method.toLowerCase(),
        phone: req.payerPhone,
        description: req.description,
        callback_url: req.callbackUrl,
      }),
    });
    if (!res.ok) throw new Error(`Payteller collection failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return { gatewayRef: data.reference ?? data.id, status: 'AWAITING_PAYMENT', checkoutUrl: data.checkout_url };
  }

  // Sandbox: simulate a hosted checkout page inside the app
  const gatewayRef = `PT-SBX-${req.reference}`;
  return {
    gatewayRef,
    status: 'AWAITING_PAYMENT',
    checkoutUrl: `/pay/sandbox/${encodeURIComponent(req.reference)}`,
  };
}

/** Initiate a payout (platform pays GHS out → user MoMo/bank). */
export async function createPayout(req: PayoutRequest): Promise<PayoutResponse> {
  if (paytellerMode() === 'live') {
    const res = await fetch(`${process.env.PAYTELLER_BASE_URL}/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.PAYTELLER_API_KEY}`,
      },
      body: JSON.stringify({
        merchant_id: process.env.PAYTELLER_MERCHANT_ID,
        reference: req.reference,
        amount: req.amountGHS,
        currency: 'GHS',
        channel: req.method.toLowerCase(),
        destination: req.destination,
        destination_name: req.destName,
        description: req.description,
      }),
    });
    if (!res.ok) throw new Error(`Payteller payout failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return { gatewayRef: data.reference ?? data.id, status: 'PROCESSING' };
  }

  // Sandbox: payouts complete instantly
  return { gatewayRef: `PT-SBX-${req.reference}`, status: 'COMPLETED' };
}
