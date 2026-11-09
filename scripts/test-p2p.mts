// Temporary E2E test: P2P marketplace → order → assistant chat → checkout →
// expiry, plus a direct release test for wallet accounting.
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const BASE = 'http://localhost:3000';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, extra = '') {
  if (ok) { pass++; console.log(`  OK  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}

async function j(path: string, init?: RequestInit & { cookie?: string }) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.cookie ? { cookie: init.cookie } : {}) },
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  let body: any = null;
  try { body = await res.json(); } catch { /* ignore */ }
  return { status: res.status, body, cookies: setCookie };
}

// 1. login demo (buyer)
const login = await j('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier: 'demo@cedix.gh', password: 'Demo123!' }) });
check('login', login.status === 200, JSON.stringify(login.body));
const cookie = login.cookies.map((c) => c.split(';')[0]).join('; ');

// 2. offers list with stats + settings
const offers = await j('/api/p2p/offers?side=SELL&asset=USDT', { cookie });
check('offers list', offers.status === 200 && Array.isArray(offers.body.offers), JSON.stringify(offers.body).slice(0, 200));
check('offers settings', offers.body.settings?.enabled === true && offers.body.settings?.expiryMinutes >= 5);
let offer = offers.body.offers?.[0];
if (!offer) {
  // create a merchant offer from the admin account directly (real liquidity)
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('no admin user');
  await prisma.wallet.upsert({
    where: { userId_asset: { userId: admin.id, asset: 'USDT' } },
    update: { available: { increment: 1000 } },
    create: { userId: admin.id, asset: 'USDT', available: 1000 },
  });
  await prisma.p2POffer.create({
    data: { userId: admin.id, side: 'SELL', asset: 'USDT', priceGHS: 12.14, minGHS: 100, maxGHS: 3000, available: 650, paymentMethods: ['MTN Mobile Money', 'Telecel Cash'] },
  });
  const again = await j('/api/p2p/offers?side=SELL&asset=USDT', { cookie });
  offer = again.body.offers?.[0];
}
check('offer available', Boolean(offer), 'no SELL offer for USDT');
check('offer has stats', offer && 'stats' in offer);

// 3. create order (buy GHS 103 worth)
const create = await j('/api/p2p/orders', { method: 'POST', cookie, body: JSON.stringify({ offerId: offer.id, amountGHS: 103 }) });
check('create order', create.status === 200 && create.body.order?.id, JSON.stringify(create.body).slice(0, 200));
const orderId = create.body.order.id as string;
check('orderNo numeric', /^\d{15,}$/.test(create.body.order.orderNo ?? ''), create.body.order.orderNo);
check('expiresAt set', Boolean(create.body.order.expiresAt));

// 4. order detail + assistant seeded chat
const detail = await j(`/api/p2p/orders/${orderId}`, { cookie });
check('order detail', detail.status === 200 && detail.body.order?.id === orderId);
const kinds = (detail.body.chat ?? []).map((m: any) => m.meta?.kind);
check('assistant welcome', kinds.includes('welcome'), JSON.stringify(kinds));
check('assistant network prompt', kinds.includes('choose-network'));

// 5. choose network → sandbox checkout created
const choose = await j(`/api/p2p/orders/${orderId}`, { method: 'PUT', cookie, body: JSON.stringify({ type: 'choose-network', network: 'MTN Mobile Money' }) });
check('choose network', choose.status === 200 && typeof choose.body.checkoutUrl === 'string', JSON.stringify(choose.body).slice(0, 200));
check('sandbox checkout url', String(choose.body.checkoutUrl ?? '').startsWith('/pay/sandbox/'));

// 6. buyer message
const msg = await j(`/api/p2p/orders/${orderId}`, { method: 'PUT', cookie, body: JSON.stringify({ type: 'message', body: 'Hello, paying now' }) });
check('buyer message', msg.status === 200 && msg.body.message?.role === 'BUYER');

// 7. verify (sandbox → no provider confirmation, must NOT release)
const verify = await j(`/api/p2p/orders/${orderId}`, { method: 'PUT', cookie, body: JSON.stringify({ type: 'verify' }) });
check('verify does not release without provider', verify.status === 200 && verify.body.status !== 'RELEASED', JSON.stringify(verify.body));

// 8. wallet accounting on release (direct, simulating provider confirmation)
const before = await prisma.p2POrder.findUnique({ where: { id: orderId }, select: { buyerId: true, sellerId: true, amount: true, totalGHS: true } });
const buyerBefore = await prisma.wallet.findUnique({ where: { userId_asset: { userId: before!.buyerId, asset: 'USDT' } } });
const sellerLockedBefore = await prisma.wallet.findUnique({ where: { userId_asset: { userId: before!.sellerId, asset: 'USDT' } } });
const { releaseP2POrder } = await import('../src/lib/p2p.js');
const released = await releaseP2POrder(orderId, { reference: 'TEST-PROVIDER-REF' });
check('release status', released.status === 'RELEASED');
const buyerAfter = await prisma.wallet.findUnique({ where: { userId_asset: { userId: before!.buyerId, asset: 'USDT' } } });
const sellerAfter = await prisma.wallet.findUnique({ where: { userId_asset: { userId: before!.sellerId, asset: 'USDT' } } });
const sellerGHS = await prisma.wallet.findUnique({ where: { userId_asset: { userId: before!.sellerId, asset: 'GHS' } } });
const amt = Number(before!.amount);
check('buyer credited', Math.abs(Number(buyerAfter?.available ?? 0) - (Number(buyerBefore?.available ?? 0) + amt)) < 1e-9);
check('seller escrow spent', Math.abs(Number(sellerAfter?.locked ?? 0) - (Number(sellerLockedBefore?.locked ?? 0) - amt)) < 1e-9);
check('seller received GHS', Number(sellerGHS?.available ?? 0) > 0);
check('idempotent release', (await releaseP2POrder(orderId, { reference: 'TEST-PROVIDER-REF' })).status === 'RELEASED');

// 9. expiry: new order, force past expiry, GET should expire + return escrow
const create2 = await j('/api/p2p/orders', { method: 'POST', cookie, body: JSON.stringify({ offerId: offer.id, amountGHS: 103 }) });
const order2 = create2.body.order.id as string;
const offerBefore = await prisma.p2POffer.findUnique({ where: { id: offer.id }, select: { available: true } });
await prisma.p2POrder.update({ where: { id: order2 }, data: { expiresAt: new Date(Date.now() - 60000) } });
const detail2 = await j(`/api/p2p/orders/${order2}`, { cookie });
check('order expired', detail2.body.order?.status === 'EXPIRED', detail2.body.order?.status);
const offerAfter = await prisma.p2POffer.findUnique({ where: { id: offer.id }, select: { available: true } });
check('offer volume restored', Number(offerAfter?.available) > Number(offerBefore?.available));
const chat2 = (detail2.body.chat ?? []).map((m: any) => m.meta?.kind);
check('expiry system message', chat2.includes('expired'), JSON.stringify(chat2));

// 10. limits API + deposit minimum enforcement
const limits = await j('/api/limits');
check('limits api', limits.status === 200 && limits.body.minDepositUSD === 50 && limits.body.minWithdrawalUSD === 150, JSON.stringify(limits.body));
const smallDep = await j('/api/deposit', { method: 'POST', cookie, body: JSON.stringify({ asset: 'USDT', amountGHS: 20, method: 'MOMO', payerPhone: '0241234567' }) });
check('deposit below min rejected', smallDep.status !== 200 && /Minimum deposit/.test(String(smallDep.body?.error ?? '')), JSON.stringify(smallDep.body));
const smallWd = await j('/api/withdraw', { method: 'POST', cookie, body: JSON.stringify({ asset: 'USDT', amountAsset: 5, method: 'MOMO', destination: '0241234567' }) });
check('withdrawal below min rejected', smallWd.status !== 200 && /Minimum withdrawal/.test(String(smallWd.body?.error ?? '')), JSON.stringify(smallWd.body));

console.log(`\n${pass} passed, ${fail} failed`);
await prisma.$disconnect();
process.exit(fail > 0 ? 1 : 0);
