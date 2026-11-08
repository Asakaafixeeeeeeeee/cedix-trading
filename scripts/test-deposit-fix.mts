// Quick test: GHS deposit fix + MobileMoney withdrawal conversation.
const BASE = 'http://localhost:3000';
type Jar = { cookie: string };
async function j<T = Record<string, unknown>>(path: string, init?: RequestInit & { jar?: Jar }) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.jar ? { cookie: init.jar.cookie } : {}) },
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    if (!init?.jar) break;
    const [pair] = c.split(';');
    const [name] = pair.split('=');
    const parts = init.jar.cookie.split('; ').filter((p) => p && !p.startsWith(`${name}=`));
    parts.push(pair);
    init.jar.cookie = parts.join('; ');
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { status: res.status, body };
}
const ok = (n: string, c: boolean, d = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); if (!c) process.exitCode = 1; };

// 1. Quotes for every asset offered on the deposit page
for (const asset of ['USDT', 'BTC', 'ETH', 'SOL', 'BNB', 'GHS']) {
  const q = await j<{ amountAsset: number }>(`/api/deposit/quote?asset=${asset}&amountGHS=100`);
  ok(`quote ${asset}`, q.status === 200 && (q.body.amountAsset ?? 0) > 0, q.status === 200 ? `${q.body.amountAsset}` : q.body.error);
}

// 2. Deposit creation for GHS and USDT as ADMIN (reported scenario)
const admin: Jar = { cookie: '' };
await j('/api/admin/auth', { method: 'POST', jar: admin, body: JSON.stringify({ action: 'login', email: 'cedix1trading@gmail.com', password: 'TestAdminPass123!' }) });
for (const asset of ['GHS', 'USDT']) {
  const d = await j<{ checkoutUrl: string }>('/api/deposit', { method: 'POST', jar: admin, body: JSON.stringify({ asset, amountGHS: 100, method: 'MOMO' }) });
  ok(`admin deposit ${asset} → checkout`, d.status === 200 && Boolean(d.body.checkoutUrl), d.status === 200 ? d.body.checkoutUrl : d.body.error);
}

// 3. Withdrawal notification goes to "MobileMoney" conversation
const user: Jar = { cookie: '' };
await j('/api/auth/login', { method: 'POST', jar: user, body: JSON.stringify({ identifier: 'demo@cedix.gh', password: 'Demo123!' }) });
await j('/api/withdraw', { method: 'POST', jar: user, body: JSON.stringify({ asset: 'USDT', amountAsset: 3, method: 'MOMO', destination: '0244123456' }) });
await new Promise((r) => setTimeout(r, 1800));

const device: Jar = { cookie: '' };
const accs = await j<{ accounts: { userId: string; email: string }[] }>('/api/admin/messages', { jar: admin });
const demoAcc = accs.body.accounts.find((a) => a.email === 'demo@cedix.gh')!;
const inv = await j<{ token: string }>('/api/admin/messages', { method: 'POST', jar: admin, body: JSON.stringify({ action: 'invite', userId: demoAcc.userId }) });
await j('/api/messages/register', { method: 'POST', jar: device, body: JSON.stringify({ token: inv.body.token }) });
const convs = await j<{ conversations: { id: string; name: string; last: { title: string | null } | null }[] }>('/api/messages/conversations', { jar: device });
const momo = convs.body.conversations.find((c) => c.name === 'MobileMoney');
ok('MobileMoney conversation exists', Boolean(momo));
ok('withdrawal message in MobileMoney', momo?.last?.title === 'Withdrawal Request Received', momo?.last?.title ?? 'none');

console.log('\nDone.');
