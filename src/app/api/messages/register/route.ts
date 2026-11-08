import { api } from '@/lib/api';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { setMessagesSession } from '@/lib/messagesAuth';

/** Complete invite-only registration for the Messages app. */
export async function POST(req: Request) {
  return api(async () => {
    const { token, displayName, password } = await req.json();
    if (!token) throw new Error('Invitation token required');
    if (!displayName || String(displayName).trim().length < 2) throw new Error('Display name required');
    if (!password || String(password).length < 8) throw new Error('Password must be at least 8 characters');

    const invite = await prisma.messagesInvite.findUnique({ where: { token } });
    if (!invite || invite.revokedAt) throw new Error('This invitation is not valid');
    if (invite.usedAt) throw new Error('This invitation has already been used');
    if (invite.expiresAt < new Date()) throw new Error('This invitation has expired — ask the administrator for a new one');

    const account = await prisma.messagesAccount.findUnique({ where: { userId: invite.userId } });
    if (!account) throw new Error('Messages access has not been enabled for this account');
    if (account.suspended) throw new Error('This Messages account has been suspended');

    const passwordHash = await hashPassword(String(password));
    await prisma.$transaction([
      prisma.messagesAccount.update({
        where: { userId: invite.userId },
        data: { passwordHash, displayName: String(displayName).trim().slice(0, 50), registeredAt: new Date() },
      }),
      prisma.messagesInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } }),
      // Welcome conversation so the app isn't empty on first open
      prisma.conversation.upsert({
        where: { userId_name: { userId: invite.userId, name: 'CediX Trading' } },
        update: {},
        create: {
          userId: invite.userId,
          name: 'CediX Trading',
          system: true,
          messages: {
            create: {
              sender: 'SYSTEM',
              title: 'Welcome to Messages',
              body: 'This is your private CediX Trading notification inbox. Transaction updates for your account will appear here automatically.\n\nTip: add this app to your Home Screen and enable notifications so you never miss an update.',
            },
          },
        },
      }),
    ]);

    await setMessagesSession(invite.userId);
    return { ok: true };
  });
}
