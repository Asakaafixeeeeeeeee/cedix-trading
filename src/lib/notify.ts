// Notification dispatch for the Messages app.
//
// notifyUser() is the single entry point used by the withdrawal pipeline and
// admin announcements. For users with an active Messages account it:
//   1. renders the (admin-editable) template,
//   2. stores the message in their "CediX Trading" conversation,
//   3. sends a Web Push to every registered device (honest pushStatus),
//   4. queues/sends the matching email via src/lib/email.ts.
// Users without Messages access still get the email path — the Messages app
// is optional and never blocks normal platform flows.

import { generateVAPIDKeys, sendNotification, setVapidDetails } from 'web-push';
import { prisma } from './db';
import { sendEmail, emailHtml } from './email';
import { getPortfolio } from './wallet';

export type TemplateKind =
  | 'withdrawal_requested'
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'withdrawal_payment_sent'
  | 'withdrawal_completed'
  | 'deposit_completed'
  | 'announcement';

export type Template = { title: string; body: string };

export const DEFAULT_TEMPLATES: Record<TemplateKind, Template> = {
  withdrawal_requested: {
    title: 'Withdrawal Request Received',
    body: 'Amount: {{amountUSD}}\nEstimated GHS Value: {{amountGHS}}\nStatus: Pending Review\nReference: {{reference}}\nCurrent Balance: {{balanceGHS}}\n\nYour withdrawal request has been received and is awaiting review.',
  },
  withdrawal_approved: {
    title: 'Withdrawal Approved',
    body: 'Amount: {{amountUSD}}\nStatus: Approved — Awaiting Payment\nReference: {{reference}}\n\nYour withdrawal has been approved and is awaiting payment processing.',
  },
  withdrawal_rejected: {
    title: 'Withdrawal Rejected',
    body: 'Amount: {{amountUSD}}\nStatus: Rejected\nReference: {{reference}}\nReason: {{reason}}\nCurrent Balance: {{balanceGHS}}\n\nYour funds have been returned to your wallet.',
  },
  withdrawal_payment_sent: {
    title: 'Withdrawal Payment Sent',
    body: 'Amount: {{amountGHS}}\nStatus: Payment Sent\nReference: {{reference}}\nTransaction Reference: {{providerRef}}\n\nYour withdrawal payment has been sent.',
  },
  withdrawal_completed: {
    title: 'Withdrawal Completed',
    body: 'Amount: {{amountGHS}}\nStatus: Completed\nReference: {{reference}}\nCurrent Balance: {{balanceGHS}}\n\nYour withdrawal payment has been confirmed.',
  },
  deposit_completed: {
    title: 'Deposit Successful',
    body: 'Amount: {{amountGHS}}\nCredited: {{amountAsset}}\nReference: {{reference}}\nCurrent Balance: {{balanceGHS}}\nAvailable Balance: {{balanceGHS}}\n\nYour deposit has been credited to your funding wallet.',
  },
  announcement: {
    title: '{{title}}',
    body: '{{body}}',
  },
};

const SYSTEM_CONVERSATION = 'CediX Trading';

export async function getTemplates(): Promise<Record<TemplateKind, Template>> {
  const row = await prisma.setting.findUnique({ where: { key: 'messages_templates' } });
  const overrides = (row?.value ?? {}) as Partial<Record<TemplateKind, Template>>;
  return { ...DEFAULT_TEMPLATES, ...overrides };
}

export function renderTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? '');
}

// ───────── Web Push (VAPID keys auto-generated once, kept server-side) ─────────

let vapidCache: { publicKey: string; privateKey: string } | null = null;

export async function getVapidKeys() {
  if (vapidCache) return vapidCache;
  const row = await prisma.setting.findUnique({ where: { key: 'vapid_keys' } });
  if (row && (row.value as { publicKey?: string })?.publicKey) {
    vapidCache = row.value as { publicKey: string; privateKey: string };
    return vapidCache;
  }
  const keys = generateVAPIDKeys();
  const value = { publicKey: keys.publicKey, privateKey: keys.privateKey };
  await prisma.setting.upsert({
    where: { key: 'vapid_keys' },
    update: { value },
    create: { key: 'vapid_keys', value },
  });
  vapidCache = value;
  return vapidCache;
}

/** Push to every device of a user. Returns sent/failed counts; prunes dead subscriptions. */
async function pushToUser(userId: string, payload: { title: string; body: string; url: string }) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return { sent: 0, failed: 0, none: true };
  const keys = await getVapidKeys();
  setVapidDetails('mailto:support@cedix.app', keys.publicKey, keys.privateKey);

  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 86400 },
        );
        sent++;
      } catch (e: unknown) {
        failed++;
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    }),
  );
  return { sent, failed, none: false };
}

// ───────── Main dispatch ─────────

export type NotifyOptions = {
  kind: TemplateKind;
  vars: Record<string, string>;
  meta?: Record<string, unknown>;
  /** Also send an email (default true). */
  email?: boolean;
};

export async function notifyUser(userId: string, opts: NotifyOptions) {
  const templates = await getTemplates();
  const tpl = templates[opts.kind] ?? DEFAULT_TEMPLATES[opts.kind];

  // Real account balance (never a fixed example): computed live from the
  // user's wallets whenever a template asks for {{balanceGHS}}.
  const vars = { ...opts.vars };
  if (vars.balanceGHS === undefined && `${tpl.title}\n${tpl.body}`.includes('{{balanceGHS}}')) {
    try {
      const portfolio = await getPortfolio(userId);
      vars.balanceGHS = `GH₵${portfolio.totalGHS.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } catch {
      vars.balanceGHS = '';
    }
  }

  const title = renderTemplate(tpl.title, vars);
  const body = renderTemplate(tpl.body, vars)
    .split('\n')
    .filter((line) => !/:\s*$/.test(line.trim())) // drop lines whose value is unavailable
    .join('\n');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  // 1-3. In-app message + push — only for users with active Messages access.
  const account = await prisma.messagesAccount.findUnique({ where: { userId } });
  if (account && !account.suspended) {
    const conversation = await prisma.conversation.upsert({
      where: { userId_name: { userId, name: SYSTEM_CONVERSATION } },
      update: { updatedAt: new Date() },
      create: { userId, name: SYSTEM_CONVERSATION, system: true },
    });

    const push = await pushToUser(userId, {
      title: `CediX Trading`,
      body: `${title} — ${body.split('\n')[0]}`,
      url: '/messages',
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: 'SYSTEM',
        title,
        body,
        meta: { kind: opts.kind, ...(opts.meta ?? {}) },
        pushStatus: push.none ? 'no-subscription' : push.sent > 0 ? 'sent' : 'failed',
      },
    });
  }

  // 4. Email (queued honestly until Resend is connected).
  if (opts.email !== false) {
    await sendEmail({
      userId,
      to: user.email,
      subject: `CediX Trading — ${title}`,
      template: opts.kind,
      html: emailHtml(title, body.split('\n').filter(Boolean)),
    }).catch(() => {});
  }
}
