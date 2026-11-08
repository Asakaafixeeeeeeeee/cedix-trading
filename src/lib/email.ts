// Outgoing email. Every email is recorded in EmailLog with an HONEST status:
//   QUEUED  — written to the outbox, no provider configured yet
//   SENT    — the provider (Resend) actually accepted the message
//   FAILED  — the provider rejected it (error recorded)
// Set RESEND_API_KEY (and optionally EMAIL_FROM) in Render env vars to
// activate real delivery. Until then, emails stay QUEUED and are never
// claimed as delivered.

import { prisma } from './db';

const FROM = process.env.EMAIL_FROM || 'CediX Trading <noreply@cedix.app>';

export function emailEnabled() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(opts: {
  userId?: string;
  to: string;
  subject: string;
  template: string;
  html: string;
}): Promise<void> {
  const log = await prisma.emailLog.create({
    data: {
      userId: opts.userId ?? null,
      to: opts.to,
      subject: opts.subject,
      template: opts.template,
      body: opts.html,
      status: 'QUEUED',
    },
  });

  if (!emailEnabled()) return; // stays QUEUED until Resend is connected

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to: [opts.to], subject: opts.subject, html: opts.html }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      await prisma.emailLog.update({ where: { id: log.id }, data: { status: 'SENT', sentAt: new Date() } });
    } else {
      const err = await res.text().catch(() => `HTTP ${res.status}`);
      await prisma.emailLog.update({ where: { id: log.id }, data: { status: 'FAILED', error: err.slice(0, 500) } });
    }
  } catch (e) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', error: e instanceof Error ? e.message.slice(0, 500) : 'send error' },
    });
  }
}

/** Simple branded HTML wrapper for transactional emails. */
export function emailHtml(title: string, lines: string[]) {
  const body = lines.map((l) => `<p style="margin:0 0 12px;color:#333;font-size:14px;line-height:1.6">${l}</p>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#f5f6f8;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
    <h2 style="margin:0 0 6px;font-size:17px;color:#111">CediX Trading</h2>
    <h3 style="margin:0 0 18px;font-size:15px;color:#111">${title}</h3>
    ${body}
    <p style="margin:18px 0 0;color:#999;font-size:11px">This is an automated notification from CediX Trading. Do not reply to this email.</p>
  </div></body></html>`;
}
