// Temporary end-to-end test: Messages app + withdrawal review lifecycle.
// Covers: admin enable → invite → register → login → withdrawal request →
// notification → approve → payment sent → completed → rejection refund.
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
const ok = (name: string, cond: boolean, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) process.exitCode = 1;
};

// ── Sessions ──
const admin: Jar = { cookie: '' };
const user: Jar = { cookie: '' };
const msgUser: Jar = { cookie: '' };

// Admin login + PIN elevation
await j('/api/auth/login', { method: 'POST', jar: admin, body: JSON.stringify({ identifier: 'admin@cedix.gh', password: 'Admin123!' }) });
const pin = await j('/api/admin/pin', { method: 'POST', jar: admin, body: JSON.stringify({ pin: '863124' }) });
ok('admin login + PIN', pin.status === 200);

// Demo user login
const ul = await j('/api/auth/login', { method: 'POST', jar: user, body: JSON.stringify({ identifier: 'demo@cedix.gh', password: 'Demo123!' }) });
ok('demo user login', ul.status === 200);

// 1. Enable Messages access
const enable = await j<{ userId: string }>('/api/admin/messages', { method: 'POST', jar: admin, body: JSON.stringify({ action: 'enable', email: 'demo@cedix.gh' }) });
ok('admin enables Messages access', enable.status === 200, JSON.stringify(enable.body));
const userId = enable.body.userId;

// 2. Generate invitation
const inv = await j<{ token: string }>('/api/admin/messages', { method: 'POST', jar: admin, body: JSON.stringify({ action: 'invite', userId }) });
ok('admin generates invitation', inv.status === 200 && Boolean(inv.body.token));

// 3. Invite validation + registration
const check = await j<{ valid: boolean; email: string }>(`/api/messages/invite?token=${inv.body.token}`);
ok('invite link validates', check.status === 200 && check.body.valid === true, check.body.email);
const reg = await j('/api/messages/register', { method: 'POST', jar: msgUser, body: JSON.stringify({ token: inv.body.token, displayName: 'Demo Tester', password: 'MsgPass123!' }) });
ok('registration via invite', reg.status === 200);

// Reusing the invite must fail
const reg2 = await j('/api/messages/register', { method: 'POST', body: JSON.stringify({ token: inv.body.token, displayName: 'X', password: 'MsgPass123!' }) });
ok('used invite rejected', reg2.status === 400, reg2.body.error);

// 4. Messages login (fresh session) + me
const msgUser2: Jar = { cookie: '' };
const ml = await j('/api/messages/auth/login', { method: 'POST', jar: msgUser2, body: JSON.stringify({ email: 'demo@cedix.gh', password: 'MsgPass123!' }) });
ok('Messages login', ml.status === 200);
const me = await j<{ user: { displayName: string } | null }>('/api/messages/auth/me', { jar: msgUser2 });
ok('Messages session valid', Boolean(me.body.user));

// Wrong password must fail
const mlBad = await j('/api/messages/auth/login', { method: 'POST', body: JSON.stringify({ email: 'demo@cedix.gh', password: 'wrong' }) });
ok('wrong password rejected', mlBad.status === 400);

// Conversations include welcome message
const convs = await j<{ conversations: { id: string; name: string; unread: number }[] }>('/api/messages/conversations', { jar: msgUser2 });
const cedixConv = convs.body.conversations.find((c) => c.name === 'CediX Trading');
ok('welcome conversation exists', Boolean(cedixConv), `unread=${cedixConv?.unread}`);

// 5. Withdrawal request → PENDING_REVIEW + notification
const wd = await j<{ withdrawal: { id: string; status: string }; netGHS: number }>('/api/withdraw', {
  method: 'POST',
  jar: user,
  body: JSON.stringify({ asset: 'USDT', amountAsset: 5, method: 'MOMO', destination: '0244123456', destName: 'Demo Tester' }),
});
ok('withdrawal request created', wd.status === 200 && wd.body.withdrawal?.status === 'PENDING_REVIEW', JSON.stringify(wd.body.withdrawal?.status));
const wdId = wd.body.withdrawal.id;

await new Promise((r) => setTimeout(r, 1500)); // notification is fire-and-forget
const t1 = await j<{ conversation: { messages: { title: string | null }[] } }>(`/api/messages/conversations/${cedixConv!.id}`, { jar: msgUser2 });
const titles = () => t1.body.conversation.messages.map((m) => m.title);
ok('request notification delivered', titles().includes('Withdrawal Request Received'), JSON.stringify(titles()));

// 6. Admin approves
const ap = await j('/api/admin/withdrawals', { method: 'PATCH', jar: admin, body: JSON.stringify({ id: wdId, action: 'approve' }) });
ok('admin approve', ap.status === 200);

// complete must fail before payment recorded
const badComplete = await j('/api/admin/withdrawals', { method: 'PATCH', jar: admin, body: JSON.stringify({ id: wdId, action: 'complete' }) });
ok('complete blocked before payment', badComplete.status === 400, badComplete.body.error);

// mark-sent without provider ref must fail
const badSent = await j('/api/admin/withdrawals', { method: 'PATCH', jar: admin, body: JSON.stringify({ id: wdId, action: 'mark-sent' }) });
ok('payment-sent requires provider ref', badSent.status === 400, badSent.body.error);

// 7. Record payment sent + complete
const sent = await j('/api/admin/withdrawals', { method: 'PATCH', jar: admin, body: JSON.stringify({ id: wdId, action: 'mark-sent', providerRef: '93322889113' }) });
ok('payment sent recorded', sent.status === 200);
const comp = await j('/api/admin/withdrawals', { method: 'PATCH', jar: admin, body: JSON.stringify({ id: wdId, action: 'complete' }) });
ok('completed recorded', comp.status === 200);

await new Promise((r) => setTimeout(r, 1500));
const t2 = await j<{ conversation: { messages: { title: string | null }[] } }>(`/api/messages/conversations/${cedixConv!.id}`, { jar: msgUser2 });
const allTitles = t2.body.conversation.messages.map((m) => m.title);
ok('approved notification', allTitles.includes('Withdrawal Approved'));
ok('payment sent notification', allTitles.includes('Withdrawal Payment Sent'));
ok('completed notification', allTitles.includes('Withdrawal Completed'));

// 8. Rejection refunds funds
type Pf = { assets?: { asset: string; available: number }[] };
const before = await j<Pf>('/api/portfolio', { jar: user });
const balBefore = before.body.assets?.find((a) => a.asset === 'USDT')?.available ?? 0;
const wd2 = await j<{ withdrawal: { id: string } }>('/api/withdraw', {
  method: 'POST',
  jar: user,
  body: JSON.stringify({ asset: 'USDT', amountAsset: 5, method: 'MOMO', destination: '0244123456' }),
});
const rej = await j('/api/admin/withdrawals', { method: 'PATCH', jar: admin, body: JSON.stringify({ id: wd2.body.withdrawal.id, action: 'reject', reason: 'Test rejection — verification mismatch' }) });
ok('admin reject', rej.status === 200);
const after = await j<Pf>('/api/portfolio', { jar: user });
const balAfter = after.body.assets?.find((a) => a.asset === 'USDT')?.available ?? 0;
ok('rejection refunds funds', Math.abs(balAfter - balBefore) < 1e-9, `before=${balBefore} after=${balAfter}`);

await new Promise((r) => setTimeout(r, 1200));
const t3 = await j<{ conversation: { messages: { title: string | null }[] } }>(`/api/messages/conversations/${cedixConv!.id}`, { jar: msgUser2 });
ok('rejected notification', t3.body.conversation.messages.some((m) => m.title === 'Withdrawal Rejected'));

// 9. Unread + mark read
const unread1 = await j<{ unread: number }>('/api/messages/unread', { jar: msgUser2 });
ok('unread count > 0', (unread1.body.unread ?? 0) > 0, `unread=${unread1.body.unread}`);
await j(`/api/messages/conversations/${cedixConv!.id}`, { method: 'POST', jar: msgUser2 });
const unread2 = await j<{ unread: number }>('/api/messages/unread', { jar: msgUser2 });
ok('mark read works', unread2.body.unread === 0);

// 10. Security: other users cannot read this conversation
const stranger: Jar = { cookie: '' };
const sr = await j(`/api/messages/conversations/${cedixConv!.id}`, { jar: stranger });
ok('anonymous access blocked', sr.status === 401);

// 11. Suspend blocks login
await j('/api/admin/messages', { method: 'POST', jar: admin, body: JSON.stringify({ action: 'suspend', userId }) });
const mlSusp = await j('/api/messages/auth/login', { method: 'POST', body: JSON.stringify({ email: 'demo@cedix.gh', password: 'MsgPass123!' }) });
ok('suspended login blocked', mlSusp.status === 400, mlSusp.body.error);
const meSusp = await j<{ user: unknown }>('/api/messages/auth/me', { jar: msgUser2 });
ok('suspended session invalidated', meSusp.body.user === null);
await j('/api/admin/messages', { method: 'POST', jar: admin, body: JSON.stringify({ action: 'restore', userId }) });
const mlRest = await j('/api/messages/auth/login', { method: 'POST', body: JSON.stringify({ email: 'demo@cedix.gh', password: 'MsgPass123!' }) });
ok('restore re-enables login', mlRest.status === 200);

// 12. Announcement
const ann = await j<{ sent: number }>('/api/admin/messages', { method: 'POST', jar: admin, body: JSON.stringify({ action: 'announce', title: 'Scheduled maintenance', body: 'CediX will undergo maintenance tonight at 10 PM GMT.' }) });
ok('announcement sent', ann.status === 200 && (ann.body.sent ?? 0) >= 1, `sent=${ann.body.sent}`);

// 13. Email outbox honest statuses
const adminData = await j<{ emailLogs: { status: string }[] }>('/api/admin/messages', { jar: admin });
const statuses = [...new Set(adminData.body.emailLogs.map((e) => e.status))];
ok('emails queued (not falsely SENT)', adminData.body.emailLogs.length > 0 && !statuses.includes('SENT'), `statuses=${statuses.join(',')}`);

console.log('\nDone.');
