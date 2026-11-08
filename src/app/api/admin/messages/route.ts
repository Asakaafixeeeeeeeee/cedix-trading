import { randomBytes } from 'node:crypto';
import { api } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireElevatedAdmin } from '@/lib/auth';
import { DEFAULT_TEMPLATES, getTemplates, notifyUser, type Template, type TemplateKind } from '@/lib/notify';

/** Admin: MESSAGES APP MANAGEMENT — access, invites, templates, delivery. */
export async function GET() {
  return api(async () => {
    await requireElevatedAdmin();
    const [accounts, invites, templates, recentMessages, emailLogs] = await Promise.all([
      prisma.messagesAccount.findMany({
        include: {
          user: { select: { email: true, username: true, _count: { select: { pushSubscriptions: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.messagesInvite.findMany({
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      getTemplates(),
      prisma.message.findMany({
        where: { sender: 'SYSTEM' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { conversation: { select: { user: { select: { email: true } } } } },
      }),
      prisma.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);

    return {
      accounts: accounts.map((a) => ({
        userId: a.userId,
        email: a.user.email,
        username: a.user.username,
        displayName: a.displayName,
        registered: Boolean(a.registeredAt),
        suspended: a.suspended,
        devices: a.user._count.pushSubscriptions,
        createdAt: a.createdAt,
      })),
      invites: invites.map((i) => ({
        id: i.id,
        email: i.user.email,
        token: i.token,
        expiresAt: i.expiresAt,
        usedAt: i.usedAt,
        revokedAt: i.revokedAt,
        createdAt: i.createdAt,
      })),
      templates,
      defaultTemplates: DEFAULT_TEMPLATES,
      recentMessages: recentMessages.map((m) => ({
        id: m.id,
        email: m.conversation.user.email,
        title: m.title,
        pushStatus: m.pushStatus,
        readAt: m.readAt,
        createdAt: m.createdAt,
      })),
      emailLogs: emailLogs.map((e) => ({
        id: e.id,
        to: e.to,
        subject: e.subject,
        status: e.status,
        error: e.error,
        createdAt: e.createdAt,
      })),
    };
  });
}

export async function POST(req: Request) {
  return api(async () => {
    const admin = await requireElevatedAdmin();
    const body = await req.json();
    const action = String(body.action ?? '');

    const audit = (a: string, targetId?: string, meta?: Record<string, string | number | boolean>) =>
      prisma.auditLog.create({
        data: { adminId: admin.id, action: `messages.${a}`, targetType: 'MESSAGES', targetId: targetId ?? null, meta: meta ? { ...meta } : undefined },
      });

    if (action === 'enable') {
      const email = String(body.email ?? '').toLowerCase().trim();
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) throw new Error('No CediX user with that email');
      const account = await prisma.messagesAccount.upsert({
        where: { userId: user.id },
        update: { suspended: false },
        create: { userId: user.id, displayName: user.displayName || user.username },
      });
      await audit('enable', user.id, { email });
      return { ok: true, userId: user.id, registered: Boolean(account.registeredAt) };
    }

    if (action === 'invite') {
      const userId = String(body.userId ?? '');
      const account = await prisma.messagesAccount.findUnique({ where: { userId } });
      if (!account) throw new Error('Enable Messages access for this user first');
      if (account.suspended) throw new Error('This account is suspended');
      // Revoke previous unused invites, then issue a fresh 7-day token.
      await prisma.messagesInvite.updateMany({
        where: { userId, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const token = randomBytes(24).toString('base64url');
      const invite = await prisma.messagesInvite.create({
        data: { token, userId, createdBy: admin.id, expiresAt: new Date(Date.now() + 7 * 86400000) },
      });
      await audit('invite', userId);
      return { ok: true, token: invite.token, expiresAt: invite.expiresAt };
    }

    if (action === 'revoke-invite') {
      await prisma.messagesInvite.update({ where: { id: String(body.id) }, data: { revokedAt: new Date() } });
      await audit('revoke_invite', String(body.id));
      return { ok: true };
    }

    if (action === 'suspend' || action === 'restore') {
      const userId = String(body.userId ?? '');
      await prisma.messagesAccount.update({ where: { userId }, data: { suspended: action === 'suspend' } });
      await audit(action, userId);
      return { ok: true };
    }

    if (action === 'disable') {
      const userId = String(body.userId ?? '');
      // Removes access + devices; conversation history is preserved.
      await prisma.$transaction([
        prisma.messagesAccount.delete({ where: { userId } }),
        prisma.pushSubscription.deleteMany({ where: { userId } }),
        prisma.messagesInvite.updateMany({ where: { userId, usedAt: null }, data: { revokedAt: new Date() } }),
      ]);
      await audit('disable', userId);
      return { ok: true };
    }

    if (action === 'save-templates') {
      const incoming = (body.templates ?? {}) as Record<string, Template>;
      const clean: Partial<Record<TemplateKind, Template>> = {};
      for (const key of Object.keys(DEFAULT_TEMPLATES) as TemplateKind[]) {
        const t = incoming[key];
        if (t && typeof t.title === 'string' && typeof t.body === 'string') {
          clean[key] = { title: t.title.slice(0, 200), body: t.body.slice(0, 2000) };
        }
      }
      await prisma.setting.upsert({
        where: { key: 'messages_templates' },
        update: { value: clean },
        create: { key: 'messages_templates', value: clean },
      });
      await audit('save_templates');
      return { ok: true };
    }

    if (action === 'announce') {
      const title = String(body.title ?? '').trim();
      const text = String(body.body ?? '').trim();
      if (!title || !text) throw new Error('Title and body are required');
      const targets = body.userId
        ? [{ userId: String(body.userId) }]
        : await prisma.messagesAccount.findMany({ where: { suspended: false, registeredAt: { not: null } }, select: { userId: true } });
      for (const t of targets) {
        await notifyUser(t.userId, { kind: 'announcement', vars: { title, body: text }, email: body.email === true });
      }
      await audit('announce', undefined, { title, count: targets.length });
      return { ok: true, sent: targets.length };
    }

    throw new Error('Unknown action');
  });
}
