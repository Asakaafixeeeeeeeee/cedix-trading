// Temporary end-to-end test of the sandbox deposit settlement path.
const BASE = 'http://localhost:3000';

async function j(path: string, init?: RequestInit & { cookie?: string }) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.cookie ? { cookie: init.cookie } : {}),
    },
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  let body: unknown = null;
  try { body = await res.json(); } catch { /* ignore */ }
  return { status: res.status, body: body as Record<string, never>, cookies: setCookie };
}

// 1. login
const login = await j('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier: 'demo@cedix.gh', password: 'Demo123!' }) });
if (login.status !== 200) throw new Error(`login failed: ${login.status} ${JSON.stringify(login.body)}`);
const cookie = login.cookies.map((c) => c.split(';')[0]).join('; ');
console.log('login OK');

// 2. wallet before
type Pf = { assets?: { asset: string; available: number }[] };
const before = await j('/api/portfolio', { cookie });
const usdtBefore = Number((before.body as Pf).assets?.find((w) => w.asset === 'USDT')?.available ?? 0);
console.log('USDT before:', usdtBefore);

// 3. create deposit (sandbox)
const dep = await j('/api/deposit', { method: 'POST', cookie, body: JSON.stringify({ asset: 'USDT', amountGHS: 50, method: 'MOMO' }) });
if (dep.status !== 200) throw new Error(`deposit failed: ${dep.status} ${JSON.stringify(dep.body)}`);
const depId = (dep.body as { id?: string }).id!;
const checkoutUrl = (dep.body as { checkoutUrl?: string }).checkoutUrl!;
console.log('deposit created:', depId, '→', checkoutUrl);
if (!checkoutUrl.startsWith('/pay/sandbox/')) throw new Error('expected sandbox checkout URL');

// 4. status should be AWAITING_PAYMENT
const st1 = await j(`/api/deposit/${depId}`, { cookie });
console.log('status before pay:', (st1.body as { deposit?: { status: string } }).deposit?.status);

// 5. live webhook must refuse unsigned requests (sandbox mode → 503)
const wh = await j('/api/webhooks/payteller', { method: 'POST', body: JSON.stringify({ id: 'evt', type: 'payment.successful', data: {} }) });
console.log('live webhook in sandbox mode →', wh.status, '(expect 503)');

// 6. simulate successful payment via sandbox confirmation
const sb1 = await j('/api/payteller/webhook', { method: 'POST', body: JSON.stringify({ reference: depId, status: 'success' }) });
console.log('sandbox confirm #1 →', sb1.status, JSON.stringify(sb1.body));

// 7. duplicate delivery must NOT credit twice
const sb2 = await j('/api/payteller/webhook', { method: 'POST', body: JSON.stringify({ reference: depId, status: 'success' }) });
console.log('sandbox confirm #2 (duplicate) →', sb2.status, JSON.stringify(sb2.body));

// 8. verify wallet credited exactly once
const after = await j('/api/portfolio', { cookie });
const usdtAfter = Number((after.body as Pf).assets?.find((w) => w.asset === 'USDT')?.available ?? 0);
const st2 = await j(`/api/deposit/${depId}`, { cookie });
const depFinal = (st2.body as { deposit?: { status: string; amountAsset: string } }).deposit!;
console.log('final status:', depFinal.status);
console.log('USDT after:', usdtAfter, `(delta ${ (usdtAfter - usdtBefore).toFixed(6) }, expected ~${Number(depFinal.amountAsset).toFixed(6)})`);

const delta = usdtAfter - usdtBefore;
const expected = Number(depFinal.amountAsset);
if (depFinal.status !== 'COMPLETED') throw new Error('deposit not completed');
if (Math.abs(delta - expected) > 1e-6) throw new Error(`credited ${delta}, expected exactly ${expected} — double credit or missing credit!`);
console.log('\nALL E2E CHECKS PASSED — credited exactly once.');
