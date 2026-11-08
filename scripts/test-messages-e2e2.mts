// Temporary end-to-end test v2: device-activation Messages flow + email/password
// admin auth + withdrawal review lifecycle.
const BASE = 'http://localhost:3000';
const ADMIN_EMAIL = 'cedix1trading@gmail.com';
const ADMIN_PASSWORD = 'TestAdminPass123!'; // local dev DB only

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
const ok = (name: string, cond: boolean, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) process.exitCode = 1;
};

const admin: Jar = { cookie: '' };
const device: Jar = { cookie: '' };
const user: Jar = { cookie: '' };

// ── Admin auth: one-time setup (PIN → password), then email+password login ──
const status = await j<{ configured: boolean; email: string }>('/api/admin/auth');
ok('admin auth status endpoint', status.status === 200, `configured=${status.body.configured}`);

if (!status.body.configured) {
  const badPin = await j('/api/admin/auth', { method: 'POST', body: JSON.stringify({ action: 'setup', pin: '000000', password: ADMIN_PASSWORD }) });
  ok('setup rejects wrong PIN', badPin.status === 401, badPin.body.error);
  const setup = await j('/api/admin/auth', { method: 'POST', jar: admin, body: JSON.stringify({ action: 'setup', pin: '863124', password: ADMIN_PASSWORD }) });
  ok('one-time password setup with PIN', setup.status === 200, JSON.stringify(setup.body));
  const again = await j('/api/admin/auth', { method: 'POST', body: JSON.stringify({ action: 'setup', pin: '863124', password: 'AnotherPass123!' }) });
  ok('second setup blocked', again.status === 409, again.body.error);
} else {
  const login0 = await j('/api/admin/auth', { method: 'POST', jar: admin, body: JSON.stringify({ action: 'login', email: ADMIN_EMAIL, password: ADMIN_PASSWORD }) });
  ok('admin already configured, login works', login0.status === 200);
}

// Fresh login session (proves email+password login works)
const admin2: Jar = { cookie: '' };
const login = await j('/api/admin/auth', { method: 'POST', jar: admin2, body: JSON.stringify({ action: 'login', email: ADMIN_EMAIL, password: ADMIN_PASSWORD }) });
ok('admin email+password login', login.status === 200);
const wrongPw = await j('/api/admin/auth', { method: 'POST', body: JSON.stringify({ action: 'login', email: ADMIN_EMAIL, password: 'WrongPass123!' }) });
ok('wrong admin password rejected', wrongPw.status === 401);
const stats = await j('/api/admin/stats', { jar: admin2 });
ok('elevated dashboard access after login', stats.status === 200);
const oldPin = await j('/api/admin/pin', { method: 'POST', jar: admin2, body: JSON.stringify({ pin: '863124' }) });
ok('old PIN endpoint removed', oldPin.status === 404 || oldPin.status === 405, `status=${oldPin.status}`);

// ── Messages: device activation flow (no login page) ──
const me0 = await j<{ user: unknown }>('/api/messages/auth/me');
ok('unactivated device has no session', me0.body.user === null);

const enable = await j<{ userId: string }>('/api/admin/messages', { method: 'POST', jar: admin2, body: JSON.stringify({ action: 'enable', email: 'demo@cedix.gh' }) });
ok('admin enables Messages access', enable.status === 200);
const userId = enable.body.userId;

const inv = await j<{ token: string }>('/api/admin/messages', { method: 'POST', jar: admin2, body: JSON.stringify({ action: 'invite', userId }) });
ok('admin generates invitation', inv.status === 200 && Boolean(inv.body.token));

const act = await j('/api/messages/register', { method: 'POST', jar: device, body: JSON.stringify({ token: inv.body.token }) });
ok('device activation via invite (no password)', act.status === 200);
const act2 = await j('/api/messages/register', { method: 'POST', body: JSON.stringify({ token: inv.body.token }) });
ok('used invitation rejected', act2.status === 400, act2.body.error);

const me1 = await j<{ user: { displayName: string } | null }>('/api/messages/auth/me', { jar: device });
ok('activated device opens straight to messages', Boolean(me1.body.user), me1.body.user?.displayName);

// ── Withdrawal lifecycle with notifications ──
await j('/api/auth/login', { method: 'POST', jar: user, body: JSON.stringify({ identifier: 'demo@cedix.gh', password: 'Demo123!' }) });
const wd = await j<{ withdrawal: { id: string; status: string } }>('/api/withdraw', {
  method: 'POST',
  jar: user,
  body: JSON.stringify({ asset: 'USDT', amountAsset: 4, method: 'MOMO', destination: '0244123456' }),
});
ok('withdrawal request → PENDING_REVIEW', wd.body.withdrawal?.status === 'PENDING_REVIEW');
const wdId = wd.body.withdrawal.id;

await new Promise((r) => setTimeout(r, 1800));
const convs = await j<{ conversations: { id: string; name: string }[] }>('/api/messages/conversations', { jar: device });
const conv = convs.body.conversations.find((c) => c.name === 'CediX Trading')!;
let t = await j<{ conversation: { messages: { title: string | null; body: string }[] } }>(`/api/messages/conversations/${conv.id}`, { jar: device });
const reqMsg = t.body.conversation.messages.filter((m) => m.title === 'Withdrawal Request Received').pop();
ok('request notification delivered', Boolean(reqMsg));
ok('notification shows REAL current balance', /Current Balance: GH₵[\d,]+\.\d{2}/.test(reqMsg?.body ?? ''), (reqMsg?.body ?? '').split('\n').find((l) => l.includes('Current Balance')));

await j('/api/admin/withdrawals', { method: 'PATCH', jar: admin2, body: JSON.stringify({ id: wdId, action: 'approve' }) });
await j('/api/admin/withdrawals', { method: 'PATCH', jar: admin2, body: JSON.stringify({ id: wdId, action: 'mark-sent', providerRef: '93777000111' }) });
await j('/api/admin/withdrawals', { method: 'PATCH', jar: admin2, body: JSON.stringify({ id: wdId, action: 'complete' }) });
await new Promise((r) => setTimeout(r, 1800));
t = await j(`/api/messages/conversations/${conv.id}`, { jar: device });
const titles = t.body.conversation.messages.map((m) => m.title);
ok('approved + sent + completed notifications', ['Withdrawal Approved', 'Withdrawal Payment Sent', 'Withdrawal Completed'].every((x) => titles.includes(x)));

// ── Access control ──
const anon = await j(`/api/messages/conversations/${conv.id}`);
ok('anonymous cannot read conversations', anon.status === 401);
await j('/api/admin/messages', { method: 'POST', jar: admin2, body: JSON.stringify({ action: 'suspend', userId }) });
const meSusp = await j<{ user: unknown }>('/api/messages/auth/me', { jar: device });
ok('suspension revokes device session instantly', meSusp.body.user === null);
await j('/api/admin/messages', { method: 'POST', jar: admin2, body: JSON.stringify({ action: 'restore', userId }) });
const meRest = await j<{ user: unknown }>('/api/messages/auth/me', { jar: device });
ok('restore re-enables the same device', Boolean(meRest.body.user));

// ── Password reset flow ──
const rr = await j('/api/auth/reset-request', { method: 'POST', body: JSON.stringify({ email: 'demo@cedix.gh' }) });
ok('password reset request accepted', rr.status === 200);
const badReset = await j('/api/auth/reset', { method: 'POST', body: JSON.stringify({ email: 'demo@cedix.gh', token: 'wrong-token', password: 'NewPass123!' }) });
ok('invalid reset token rejected', badReset.status === 400);

// ── Email outbox honest ──
const adminData = await j<{ emailLogs: { status: string; template: string }[] }>('/api/admin/messages', { jar: admin2 });
const tpls = [...new Set(adminData.body.emailLogs.map((e) => e.template))];
ok('emails queued for events', adminData.body.emailLogs.length > 0, `templates=${tpls.slice(0, 6).join(',')}`);
ok('no email falsely marked SENT', !adminData.body.emailLogs.some((e) => e.status === 'SENT'));

console.log('\nDone.');
