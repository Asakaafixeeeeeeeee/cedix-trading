import { api } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireElevatedAdmin } from '@/lib/auth';
import { emailEnabled, emailHtml, sendEmail } from '@/lib/email';

/**
 * Admin bulk email broadcast.
 * Sends a branded email through the verified Resend domain to a chosen
 * audience. Sends are sequential with a small gap (provider rate limits) and
 * every message is recorded honestly in the EmailLog (SENT only when the
 * provider accepted it).
 */

type Audience = 'all' | 'active' | 'kyc' | 'messaging' | 'custom';

async function resolveRecipients(audience: Audience, custom: string[]): Promise<{ email: string; userId?: string }[]> {
  if (audience === 'custom') {
    const valid = custom
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    return [...new Set(valid)].map((email) => ({ email }));
  }
  const where =
    audience === 'active'
      ? { status: 'ACTIVE' as const }
      : audience === 'kyc'
        ? { kycLevel: { gte: 1 } }
        : audience === 'messaging'
          ? { messagesAccount: { is: { suspended: false, registeredAt: { not: null } } } }
          : {};
  const users = await prisma.user.findMany({ where, select: { id: true, email: true } });
  return users.map((u) => ({ email: u.email, userId: u.id }));
}

export async function POST(req: Request) {
  return api(async () => {
    const admin = await requireElevatedAdmin();
    const body = await req.json();
    const subject = String(body.subject ?? '').trim().slice(0, 150);
    const message = String(body.body ?? '').trim().slice(0, 10000);
    const audience = (['all', 'active', 'kyc', 'messaging', 'custom'].includes(body.audience) ? body.audience : 'all') as Audience;
    const testOnly = body.testOnly === true;

    if (!subject) throw new Error('Subject is required');
    if (!message) throw new Error('Message body is required');

    const html = emailHtml(subject, message.split('\n').filter((l) => l.trim().length > 0));

    // Test mode: send only to the administrator's own address.
    const recipients = testOnly
      ? [{ email: admin.email, userId: admin.id }]
      : await resolveRecipients(audience, Array.isArray(body.emails) ? body.emails : String(body.emails ?? '').split(/[\s,;]+/));

    if (recipients.length === 0) throw new Error('No recipients match this audience');
    if (recipients.length > 2000) throw new Error('Audience too large for a single broadcast (max 2000)');

    let sent = 0;
    let queued = 0;
    let failed = 0;
    for (const r of recipients) {
      const result = await sendEmail({
        userId: r.userId,
        to: r.email,
        subject,
        template: 'admin_broadcast',
        html,
      });
      if (result === 'SENT') sent++;
      else if (result === 'QUEUED') queued++;
      else failed++;
      // Respect provider rate limits on multi-recipient sends
      if (recipients.length > 1) await new Promise((res) => setTimeout(res, 600));
    }

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: testOnly ? 'email.broadcast_test' : 'email.broadcast',
        meta: { subject, audience, recipients: recipients.length, sent, queued, failed },
      },
    });

    return { ok: true, total: recipients.length, sent, queued, failed, providerConfigured: emailEnabled() };
  });
}

/** Audience sizes + recent broadcast history for the admin UI. */
export async function GET() {
  return api(async () => {
    await requireElevatedAdmin();
    const [all, active, kyc, messaging, recent] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { kycLevel: { gte: 1 } } }),
      prisma.messagesAccount.count({ where: { suspended: false, registeredAt: { not: null } } }),
      prisma.emailLog.findMany({
        where: { template: 'admin_broadcast' },
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: { id: true, to: true, subject: true, status: true, error: true, createdAt: true },
      }),
    ]);
    return { counts: { all, active, kyc, messaging }, providerConfigured: emailEnabled(), recent };
  });
}
