import { randomBytes } from 'node:crypto';
import { api } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireElevatedAdmin } from '@/lib/auth';
import { DEFAULT_TEMPLATES, getTemplates, getSystemSender, notifyUser, sendFromSender, type Template, type TemplateKind } from '@/lib/notify';

/** Admin: MESSAGES APP MANAGEMENT — access, invites, templates, delivery. */
export async function GET() {
  return api(async () => {
    await requireElevatedAdmin();
    await getSystemSender(); // ensure the built-in CediX Trading sender exists
    const [accounts, invites, templates, recentMessages, emailLogs, senders] = await Promise.all([
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
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { conversation: { select: { name: true, user: { select: { email: true } } } } },
      }),
      prisma.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.messageSender.findMany({ orderBy: [{ system: 'desc' }, { createdAt: 'asc' }] }),
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
        conversation: m.conversation.name,
        direction: m.sender,
        title: m.title,
        preview: m.body.split('\n')[0].slice(0, 80),
        pushStatus: m.pushStatus,
        readAt: m.readAt,
        createdAt: m.createdAt,
      })),
      senders,
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

    if (action === 'sender-create' || action === 'sender-update') {
      const name = String(body.name ?? '').trim().slice(0, 50);
      const avatarType = body.avatarType === 'LETTER' ? 'LETTER' : 'HUMAN';
      const letter = avatarType === 'LETTER' ? String(body.letter ?? name).trim().slice(0, 1).toUpperCase() : null;
      const data = {
        name,
        phone: body.phone ? String(body.phone).trim().slice(0, 25) : null,
        avatarType,
        letter,
        allowReplies: body.allowReplies === true,
        disabled: body.disabled === true,
      };
      if (!name) throw new Error('Sender name (or phone number) is required');

      if (action === 'sender-create') {
        const sender = await prisma.messageSender.create({ data });
        await audit('sender_create', sender.id, { name });
        return { ok: true, sender };
      }
      const id = String(body.id ?? '');
      const existing = await prisma.messageSender.findUnique({ where: { id } });
      if (!existing) throw new Error('Sender not found');
      const sender = await prisma.messageSender.update({ where: { id }, data });
      // Keep conversation titles in sync with the renamed sender (skip any
      // user who already has a conversation with the new name).
      if (existing.name !== name) {
        const convs = await prisma.conversation.findMany({ where: { senderId: id }, select: { id: true } });
        for (const c of convs) {
          await prisma.conversation.update({ where: { id: c.id }, data: { name } }).catch(() => {});
        }
      }
      await audit('sender_update', id, { name });
      return { ok: true, sender };
    }

    if (action === 'sender-delete') {
      const id = String(body.id ?? '');
      const sender = await prisma.messageSender.findUnique({ where: { id } });
      if (!sender) throw new Error('Sender not found');
      if (sender.system) throw new Error('The built-in CediX Trading sender cannot be deleted — disable it instead');
      await prisma.messageSender.delete({ where: { id } }); // conversations keep history (senderId → null)
      await audit('sender_delete', id, { name: sender.name });
      return { ok: true };
    }

    if (action === 'send') {
      // Send a message from a chosen sender to one user, selected users or all.
      const senderId = String(body.senderId ?? '');
      const text = String(body.body ?? '').trim();
      const title = body.title ? String(body.title).trim().slice(0, 120) : undefined;
      if (!senderId) throw new Error('Choose a sender');
      if (!text) throw new Error('Message body is required');

      let targets: { userId: string }[];
      if (body.email) {
        const u = await prisma.user.findUnique({ where: { email: String(body.email).toLowerCase().trim() } });
        if (!u) throw new Error('No CediX user with that email');
        targets = [{ userId: u.id }];
      } else {
        targets = await prisma.messagesAccount.findMany({
          where: { suspended: false, registeredAt: { not: null } },
          select: { userId: true },
        });
      }
      let delivered = 0;
      for (const t of targets) {
        const r = await sendFromSender(t.userId, senderId, { title, body: text, email: body.sendEmail === true });
        if (r.delivered) delivered++;
      }
      await audit('send', senderId, { delivered, total: targets.length });
      return { ok: true, delivered, total: targets.length };
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
