'use client';
import { useState } from 'react';
import { post, usePoll } from '@/lib/hooks';

type Account = {
  userId: string;
  email: string;
  username: string;
  displayName: string;
  registered: boolean;
  suspended: boolean;
  devices: number;
  createdAt: string;
};
type Invite = {
  id: string;
  email: string;
  token: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};
type Template = { title: string; body: string };
type Data = {
  accounts: Account[];
  invites: Invite[];
  templates: Record<string, Template>;
  defaultTemplates: Record<string, Template>;
  recentMessages: { id: string; email: string; title: string | null; pushStatus: string | null; readAt: string | null; createdAt: string }[];
  emailLogs: { id: string; to: string; subject: string; status: string; error: string | null; createdAt: string }[];
};

const dt = (s: string) => new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function AdminMessages() {
  const { data, refresh } = usePoll<Data>('/api/admin/messages', 20000);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annEmailToo, setAnnEmailToo] = useState(false);
  const [templates, setTemplates] = useState<Record<string, Template> | null>(null);
  const [sub, setSub] = useState<'users' | 'templates' | 'delivery'>('users');

  async function act(body: Record<string, unknown>, done?: (r: unknown) => void) {
    setBusy(true);
    setMsg('');
    try {
      const r = await post<Record<string, unknown>>('/api/admin/messages', body);
      done?.(r);
      refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="py-10 text-center text-sm text-muted">Loading Messages management…</p>;
  const tpls = templates ?? data.templates;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        {(['users', 'templates', 'delivery'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSub(s)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${sub === s ? 'bg-panel2 text-white' : 'text-muted hover:text-white'}`}
          >
            {s === 'users' ? 'Access & invites' : s === 'templates' ? 'Notification templates' : 'Delivery status'}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted">
          App URL: <span className="select-all text-white">https://cedixtrading.com/messages</span>
        </span>
      </div>

      {msg && <p className="mb-3 text-xs text-down">{msg}</p>}

      {sub === 'users' && (
        <>
          {/* Enable access */}
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel px-4 py-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="CediX user email"
              className="w-72 rounded-lg border border-line bg-panel2 px-3 py-1.5 text-xs outline-none"
            />
            <button
              disabled={busy || !email}
              onClick={() => act({ action: 'enable', email }, () => setEmail(''))}
              className="rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
            >
              Enable Messages access
            </button>
            {inviteLink && (
              <span className="flex w-full items-center gap-2 pt-1 text-xs">
                <span className="text-muted">Invitation link (7 days):</span>
                <span className="select-all truncate rounded bg-panel2 px-2 py-1 text-white">{inviteLink}</span>
                <button
                  onClick={() => navigator.clipboard?.writeText(inviteLink)}
                  className="shrink-0 rounded-lg bg-panel2 px-3 py-1 font-medium text-white"
                >
                  Copy
                </button>
              </span>
            )}
          </div>

          {/* Users */}
          <div className="overflow-x-auto rounded-xl border border-line bg-panel">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-2.5 pl-4 font-medium">User</th>
                  <th className="font-medium">Status</th>
                  <th className="font-medium">Devices</th>
                  <th className="font-medium">Enabled</th>
                  <th className="pr-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.accounts.map((a) => (
                  <tr key={a.userId} className="border-t border-line text-xs">
                    <td className="py-2.5 pl-4">
                      <p className="font-medium">{a.displayName}</p>
                      <p className="text-muted">{a.email}</p>
                    </td>
                    <td>
                      <span className={a.suspended ? 'text-down' : a.registered ? 'text-up' : 'text-gold'}>
                        {a.suspended ? 'Suspended' : a.registered ? 'Active' : 'Awaiting activation'}
                      </span>
                    </td>
                    <td>{a.devices}</td>
                    <td className="text-muted">{dt(a.createdAt)}</td>
                    <td className="pr-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          disabled={busy}
                          onClick={() =>
                            act({ action: 'invite', userId: a.userId }, (r) =>
                              setInviteLink(`${location.origin}/messages/activate?token=${(r as { token: string }).token}`),
                            )
                          }
                          className="rounded-lg bg-panel2 px-2.5 py-1 font-medium text-white"
                        >
                          Invite link
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => act({ action: a.suspended ? 'restore' : 'suspend', userId: a.userId })}
                          className="rounded-lg bg-panel2 px-2.5 py-1 font-medium text-white"
                        >
                          {a.suspended ? 'Restore' : 'Suspend'}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (confirm(`Remove Messages access for ${a.email}?`)) act({ action: 'disable', userId: a.userId });
                          }}
                          className="rounded-lg bg-down/15 px-2.5 py-1 font-medium text-down"
                        >
                          Disable
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.accounts.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-xs text-muted">No users enabled yet. Enter a CediX email above.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Invites */}
          <h3 className="mt-6 text-sm font-semibold">Invitations</h3>
          <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-panel">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-2.5 pl-4 font-medium">User</th>
                  <th className="font-medium">Created</th>
                  <th className="font-medium">Expires</th>
                  <th className="font-medium">Status</th>
                  <th className="pr-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.invites.map((i) => {
                  const status = i.usedAt ? 'Used' : i.revokedAt ? 'Revoked' : new Date(i.expiresAt) < new Date() ? 'Expired' : 'Active';
                  return (
                    <tr key={i.id} className="border-t border-line text-xs">
                      <td className="py-2 pl-4">{i.email}</td>
                      <td className="text-muted">{dt(i.createdAt)}</td>
                      <td className="text-muted">{dt(i.expiresAt)}</td>
                      <td className={status === 'Active' ? 'text-up' : status === 'Used' ? 'text-muted' : 'text-down'}>{status}</td>
                      <td className="pr-4 text-right">
                        {status === 'Active' && (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => navigator.clipboard?.writeText(`${location.origin}/messages/activate?token=${i.token}`)}
                              className="rounded-lg bg-panel2 px-2.5 py-1 font-medium text-white"
                            >
                              Copy link
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => act({ action: 'revoke-invite', id: i.id })}
                              className="rounded-lg bg-down/15 px-2.5 py-1 font-medium text-down"
                            >
                              Revoke
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {data.invites.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-xs text-muted">No invitations yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Announcement */}
          <h3 className="mt-6 text-sm font-semibold">Send app announcement</h3>
          <div className="mt-2 space-y-2 rounded-xl border border-line bg-panel p-4">
            <input
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder="Title"
              className="w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-xs outline-none"
            />
            <textarea
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              placeholder="Message body"
              rows={3}
              className="w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-xs outline-none"
            />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" checked={annEmailToo} onChange={(e) => setAnnEmailToo(e.target.checked)} />
                Also send as email
              </label>
              <button
                disabled={busy || !annTitle || !annBody}
                onClick={() =>
                  act({ action: 'announce', title: annTitle, body: annBody, email: annEmailToo }, () => {
                    setAnnTitle('');
                    setAnnBody('');
                  })
                }
                className="ml-auto rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
              >
                Send to all registered users
              </button>
            </div>
          </div>
        </>
      )}

      {sub === 'templates' && (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            Placeholders: {'{{amountUSD}} {{amountGHS}} {{amountAsset}} {{reference}} {{reason}} {{providerRef}} {{title}} {{body}}'}
          </p>
          {Object.keys(data.defaultTemplates).map((key) => (
            <div key={key} className="rounded-xl border border-line bg-panel p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{key.replace(/_/g, ' ')}</p>
              <input
                value={tpls[key]?.title ?? ''}
                onChange={(e) => setTemplates({ ...tpls, [key]: { ...tpls[key], title: e.target.value } })}
                className="mb-2 w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-xs outline-none"
              />
              <textarea
                value={tpls[key]?.body ?? ''}
                onChange={(e) => setTemplates({ ...tpls, [key]: { ...tpls[key], body: e.target.value } })}
                rows={4}
                className="w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-xs outline-none"
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button
              disabled={busy || !templates}
              onClick={() => act({ action: 'save-templates', templates: tpls }, () => setTemplates(null))}
              className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black disabled:opacity-50"
            >
              Save templates
            </button>
            <button
              disabled={busy}
              onClick={() => setTemplates(data.defaultTemplates)}
              className="rounded-lg bg-panel2 px-4 py-2 text-xs font-medium text-white"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      )}

      {sub === 'delivery' && (
        <>
          <h3 className="text-sm font-semibold">Recent in-app notifications</h3>
          <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-panel">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-2.5 pl-4 font-medium">Time</th>
                  <th className="font-medium">User</th>
                  <th className="font-medium">Title</th>
                  <th className="font-medium">Push</th>
                  <th className="pr-4 font-medium">Read</th>
                </tr>
              </thead>
              <tbody>
                {data.recentMessages.map((m) => (
                  <tr key={m.id} className="border-t border-line text-xs">
                    <td className="py-2 pl-4 text-muted">{dt(m.createdAt)}</td>
                    <td>{m.email}</td>
                    <td className="max-w-[220px] truncate">{m.title ?? '—'}</td>
                    <td className={m.pushStatus === 'sent' ? 'text-up' : m.pushStatus === 'failed' ? 'text-down' : 'text-muted'}>
                      {m.pushStatus ?? '—'}
                    </td>
                    <td className={`pr-4 ${m.readAt ? 'text-up' : 'text-gold'}`}>{m.readAt ? 'Read' : 'Unread'}</td>
                  </tr>
                ))}
                {data.recentMessages.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-xs text-muted">No notifications sent yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <h3 className="mt-6 text-sm font-semibold">Email outbox</h3>
          <p className="mt-1 text-xs text-muted">
            Emails stay QUEUED until the Resend API key is configured (Render env var RESEND_API_KEY). Statuses are
            honest — nothing is marked sent unless the provider accepted it.
          </p>
          <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-panel">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-2.5 pl-4 font-medium">Time</th>
                  <th className="font-medium">To</th>
                  <th className="font-medium">Subject</th>
                  <th className="pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.emailLogs.map((e) => (
                  <tr key={e.id} className="border-t border-line text-xs">
                    <td className="py-2 pl-4 text-muted">{dt(e.createdAt)}</td>
                    <td>{e.to}</td>
                    <td className="max-w-[260px] truncate">{e.subject}</td>
                    <td className={`pr-4 ${e.status === 'SENT' ? 'text-up' : e.status === 'FAILED' ? 'text-down' : 'text-gold'}`} title={e.error ?? ''}>
                      {e.status}
                    </td>
                  </tr>
                ))}
                {data.emailLogs.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-xs text-muted">No emails queued yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
