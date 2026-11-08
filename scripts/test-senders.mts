// Quick test: sender management + sender sends + replies.
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

const admin: Jar = { cookie: '' };
await j('/api/admin/auth', { method: 'POST', jar: admin, body: JSON.stringify({ action: 'login', email: 'cedix1trading@gmail.com', password: 'TestAdminPass123!' }) });

// 1. Create senders
const s1 = await j<{ sender: { id: string } }>('/api/admin/messages', { method: 'POST', jar: admin, body: JSON.stringify({ action: 'sender-create', name: 'Customer Support', avatarType: 'LETTER', letter: 'C', allowReplies: true }) });
ok('create letter sender with replies', s1.status === 200, JSON.stringify(s1.body.sender?.id ? 'id ok' : s1.body));
const s2 = await j<{ sender: { id: string } }>('/api/admin/messages', { method: 'POST', jar: admin, body: JSON.stringify({ action: 'sender-create', name: '+233 20 766 1175', avatarType: 'HUMAN' }) });
ok('create phone-number sender', s2.status === 200);

// 2. Send targeted message
const send1 = await j<{ delivered: number }>('/api/admin/messages', { method: 'POST', jar: admin, body: JSON.stringify({ action: 'send', senderId: s1.body.sender.id, email: 'demo@cedix.gh', title: 'Welcome to support', body: 'Hello! Reply to this message if you need any help with your account.' }) });
ok('send targeted message', send1.status === 200 && send1.body.delivered === 1, `delivered=${send1.body.delivered}`);
const send2 = await j<{ delivered: number }>('/api/admin/messages', { method: 'POST', jar: admin, body: JSON.stringify({ action: 'send', senderId: s2.body.sender.id, body: 'It was the last call I wanted to make with you.' }) });
ok('send to all users', send2.status === 200 && (send2.body.delivered ?? 0) >= 1, `delivered=${send2.body.delivered}`);

// 3. User sees conversations with correct sender profiles + replies
const device: Jar = { cookie: '' };
// activate a fresh device via a new invite
const accs = await j<{ accounts: { userId: string; email: string }[] }>('/api/admin/messages', { jar: admin });
const demoAcc = accs.body.accounts.find((a) => a.email === 'demo@cedix.gh')!;
const inv = await j<{ token: string }>('/api/admin/messages', { method: 'POST', jar: admin, body: JSON.stringify({ action: 'invite', userId: demoAcc.userId }) });
await j('/api/messages/register', { method: 'POST', jar: device, body: JSON.stringify({ token: inv.body.token }) });

const convs = await j<{ conversations: { id: string; name: string; sender: { avatarType: string; letter: string | null } | null }[] }>('/api/messages/conversations', { jar: device });
const support = convs.body.conversations.find((c) => c.name === 'Customer Support');
const phone = convs.body.conversations.find((c) => c.name === '+233 20 766 1175');
const cedix = convs.body.conversations.find((c) => c.name === 'CediX Trading');
ok('support conversation w/ letter avatar', support?.sender?.avatarType === 'LETTER' && support.sender.letter === 'C');
ok('phone-number conversation w/ human avatar', phone?.sender?.avatarType === 'HUMAN');
ok('CediX Trading system conversation exists', Boolean(cedix));

// 4. Reply to support (allowed), reply to phone (read-only)
const r1 = await j(`/api/messages/conversations/${support!.id}`, { method: 'PUT', jar: device, body: JSON.stringify({ body: 'Thanks, I need help with a deposit.' }) });
ok('reply allowed on support sender', r1.status === 200);
const r2 = await j(`/api/messages/conversations/${phone!.id}`, { method: 'PUT', jar: device, body: JSON.stringify({ body: 'who is this?' }) });
ok('reply blocked on read-only sender', r2.status === 400, r2.body.error);

// 5. Rename sender updates conversation
const upd = await j('/api/admin/messages', { method: 'POST', jar: admin, body: JSON.stringify({ action: 'sender-update', id: s1.body.sender.id, name: 'CediX Support', avatarType: 'LETTER', letter: 'C', allowReplies: true }) });
ok('sender rename', upd.status === 200);
const convs2 = await j<{ conversations: { name: string }[] }>('/api/messages/conversations', { jar: device });
ok('conversation renamed for user', convs2.body.conversations.some((c) => c.name === 'CediX Support'));

// 6. System sender protected
const senders = await j<{ senders: { id: string; system: boolean }[] }>('/api/admin/messages', { jar: admin });
const sys = senders.body.senders.find((s) => s.system);
if (sys) {
  const del = await j('/api/admin/messages', { method: 'POST', jar: admin, body: JSON.stringify({ action: 'sender-delete', id: sys.id }) });
  ok('system sender cannot be deleted', del.status === 400, del.body.error);
} else {
  ok('system sender exists', false, 'no system sender found');
}

console.log('\nDone.');
