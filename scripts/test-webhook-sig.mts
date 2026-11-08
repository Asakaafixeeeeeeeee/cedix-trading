// Temporary test for Payteller webhook signature verification (HMAC-SHA256).
import { createHmac } from 'node:crypto';

process.env.PAYTELLER_WEBHOOK_SECRET = 'test_secret_for_local_check_only';
const { verifyWebhookSignature } = await import('../src/lib/payteller');

const secret = 'test_secret_for_local_check_only';
const body = JSON.stringify({ id: 'evt_1', type: 'payment.successful', data: { amount: '100.00' } });
const t = Math.floor(Date.now() / 1000);
const sig = (ts: number, raw: string, sec = secret) =>
  `t=${ts},v1=${createHmac('sha256', sec).update(`${ts}.`).update(raw, 'utf8').digest('hex')}`;

const cases: [string, boolean, boolean][] = [
  ['valid signature', verifyWebhookSignature(body, sig(t, body)), true],
  ['tampered body', verifyWebhookSignature(body + ' ', sig(t, body)), false],
  ['wrong secret', verifyWebhookSignature(body, sig(t, body, 'wrong')), false],
  ['stale timestamp (>5min)', verifyWebhookSignature(body, sig(t - 600, body)), false],
  ['future timestamp (>5min)', verifyWebhookSignature(body, sig(t + 600, body)), false],
  ['missing header', verifyWebhookSignature(body, null), false],
  ['malformed header', verifyWebhookSignature(body, 't=abc,v1=xyz'), false],
  ['short hex', verifyWebhookSignature(body, `t=${t},v1=abcd`), false],
];

let fails = 0;
for (const [name, got, want] of cases) {
  const ok = got === want;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} (got ${got}, want ${want})`);
}
process.exit(fails === 0 ? 0 : 1);
