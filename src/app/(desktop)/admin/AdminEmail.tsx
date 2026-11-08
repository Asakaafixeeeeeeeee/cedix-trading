'use client';
import { useState } from 'react';
import { post, usePoll } from '@/lib/hooks';

type Data = {
  counts: { all: number; active: number; kyc: number; messaging: number };
  providerConfigured: boolean;
  recent: { id: string; to: string; subject: string; status: string; error: string | null; createdAt: string }[];
};
type SendResult = { total: number; sent: number; queued: number; failed: number };

const AUDIENCES = [
  ['all', 'All users'],
  ['active', 'Active users only'],
  ['kyc', 'KYC-verified users'],
  ['messaging', 'Messages app users'],
  ['custom', 'Custom email list'],
] as const;

const dt = (s: string) => new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function AdminEmail() {
  const { data, refresh } = usePoll<Data>('/api/admin/email', 30000);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number][0]>('all');
  const [customEmails, setCustomEmails] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const audienceCount =
    !data ? null
    : audience === 'custom' ? null
    : data.counts[audience === 'all' ? 'all' : audience === 'active' ? 'active' : audience === 'kyc' ? 'kyc' : 'messaging'];

  async function send(testOnly: boolean) {
    if (!testOnly) {
      const target = audience === 'custom' ? 'the listed addresses' : `${audienceCount ?? '?'} user(s)`;
      if (!confirm(`Send this email to ${target}? This cannot be undone.`)) return;
    }
    setBusy(true);
    setError('');
    setResult('');
    try {
      const r = await post<SendResult>('/api/admin/email', { subject, body, audience, emails: customEmails, testOnly });
      setResult(
        testOnly
          ? `Test email sent to your admin address (${r.sent ? 'delivered to provider' : 'queued'}).`
          : `Broadcast finished — ${r.sent} sent, ${r.queued} queued, ${r.failed} failed of ${r.total}.`,
      );
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="py-10 text-center text-sm text-muted">Loading email broadcast…</p>;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <div className="rounded-2xl border border-line bg-panel p-4">
          <h3 className="text-sm font-semibold">Compose broadcast</h3>
          <p className="mt-1 text-xs text-muted">
            Sent from <span className="text-foreground">noreply@cedixtrading.com</span> with CediX branding.
            {!data.providerConfigured && (
              <span className="text-gold"> Email provider not configured — messages will stay QUEUED.</span>
            )}
          </p>

          <label className="mt-4 block text-xs text-muted">
            Audience
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as typeof audience)}
              className="mt-1 w-full rounded-lg border border-line bg-panel2 px-3 py-2.5 text-sm outline-none"
            >
              {AUDIENCES.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                  {id !== 'custom' && data ? ` (${data.counts[id === 'all' ? 'all' : id === 'active' ? 'active' : id === 'kyc' ? 'kyc' : 'messaging']})` : ''}
                </option>
              ))}
            </select>
          </label>

          {audience === 'custom' && (
            <label className="mt-3 block text-xs text-muted">
              Email addresses (comma, space or newline separated)
              <textarea
                value={customEmails}
                onChange={(e) => setCustomEmails(e.target.value)}
                rows={3}
                placeholder="user1@example.com, user2@example.com"
                className="mt-1 w-full rounded-lg border border-line bg-panel2 px-3 py-2.5 text-sm outline-none"
              />
            </label>
          )}

          <label className="mt-3 block text-xs text-muted">
            Subject
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Important update from CediX Trading"
              className="mt-1 w-full rounded-lg border border-line bg-panel2 px-3 py-2.5 text-sm outline-none"
            />
          </label>

          <label className="mt-3 block text-xs text-muted">
            Message (each line becomes a paragraph)
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder={'Dear customer,\n\nWe have exciting news…'}
              className="mt-1 w-full rounded-lg border border-line bg-panel2 px-3 py-2.5 text-sm outline-none"
            />
          </label>

          {error && <p className="mt-3 text-xs text-down">{error}</p>}
          {result && <p className="mt-3 text-xs text-up">{result}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              disabled={busy || !subject.trim() || !body.trim()}
              onClick={() => send(true)}
              className="rounded-lg bg-panel2 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Send test to me'}
            </button>
            <button
              disabled={busy || !subject.trim() || !body.trim() || (audience === 'custom' && !customEmails.trim())}
              onClick={() => send(false)}
              className="rounded-lg bg-white px-5 py-2.5 text-xs font-semibold text-black disabled:opacity-50"
            >
              {busy ? 'Sending…' : `Send broadcast${audienceCount != null ? ` to ${audienceCount}` : ''}`}
            </button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Tip: always use “Send test to me” first to review the email in your own inbox. Broadcasts send one email
            per recipient with provider-safe pacing; statuses below are honest (SENT only when the provider accepted).
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Recent broadcasts</h3>
        <div className="mt-2 overflow-x-auto rounded-2xl border border-line bg-panel">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2.5 pl-4 font-medium">Time</th>
                <th className="font-medium">To</th>
                <th className="font-medium">Subject</th>
                <th className="pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((e) => (
                <tr key={e.id} className="border-t border-line text-xs">
                  <td className="py-2 pl-4 text-muted">{dt(e.createdAt)}</td>
                  <td className="max-w-[160px] truncate">{e.to}</td>
                  <td className="max-w-[200px] truncate text-muted">{e.subject}</td>
                  <td className={`pr-4 font-medium ${e.status === 'SENT' ? 'text-up' : e.status === 'FAILED' ? 'text-down' : 'text-gold'}`} title={e.error ?? ''}>
                    {e.status}
                  </td>
                </tr>
              ))}
              {data.recent.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-xs text-muted">No broadcasts sent yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
