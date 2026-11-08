const BASE = 'http://localhost:3000';
type Jar = { cookie: string };
async function j<T = Record<string, unknown>>(path: string, init?: RequestInit & { jar?: Jar }) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.jar ? { cookie: init.jar.cookie } : {}) } });
  for (const c of res.headers.getSetCookie?.() ?? []) { if (!init?.jar) break; const [pair] = c.split(';'); const [name] = pair.split('='); const parts = init.jar.cookie.split('; ').filter((p) => p && !p.startsWith(`${name}=`)); parts.push(pair); init.jar.cookie = parts.join('; '); }
  return { status: res.status, body: (await res.json().catch(() => ({}))) as T & { error?: string } };
}
const ok = (n: string, c: boolean, d = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); if (!c) process.exitCode = 1; };
const admin: Jar = { cookie: '' };
await j('/api/admin/auth', { method: 'POST', jar: admin, body: JSON.stringify({ action: 'login', email: 'cedix1trading@gmail.com', password: 'TestAdminPass123!' }) });
const info = await j<{ counts: { all: number }; providerConfigured: boolean }>('/api/admin/email', { jar: admin });
ok('audience counts', info.status === 200 && info.body.counts.all >= 2, JSON.stringify(info.body.counts));
const test = await j<{ total: number; queued: number }>('/api/admin/email', { method: 'POST', jar: admin, body: JSON.stringify({ subject: 'Test broadcast', body: 'Hello from CediX.\nThis is a test.', audience: 'all', testOnly: true }) });
ok('test-to-me send', test.status === 200 && test.body.total === 1, JSON.stringify(test.body));
const all = await j<{ total: number; queued: number; failed: number }>('/api/admin/email', { method: 'POST', jar: admin, body: JSON.stringify({ subject: 'Platform update', body: 'We have exciting news for all traders.', audience: 'all' }) });
ok('broadcast to all (queued locally)', all.status === 200 && all.body.total >= 2 && all.body.failed === 0, JSON.stringify(all.body));
const custom = await j<{ total: number }>('/api/admin/email', { method: 'POST', jar: admin, body: JSON.stringify({ subject: 'Hi', body: 'Custom list test', audience: 'custom', emails: 'a@b.com, bad-email, c@d.com c@d.com' }) });
ok('custom list dedup + validation', custom.status === 200 && custom.body.total === 2, JSON.stringify(custom.body));
const noauth = await j('/api/admin/email', { method: 'POST', body: JSON.stringify({ subject: 'x', body: 'y' }) });
ok('unauthenticated blocked', noauth.status === 401 || noauth.status === 428, String(noauth.status));
const empty = await j('/api/admin/email', { method: 'POST', jar: admin, body: JSON.stringify({ subject: '', body: 'y' }) });
ok('subject required', empty.status === 400);
console.log('Done.');
