import { api } from '@/lib/api';
import { prisma } from '@/lib/db';

/** Validate an invitation token for the registration page (no secrets leaked). */
export async function GET(req: Request) {
  return api(async () => {
    const token = new URL(req.url).searchParams.get('token') ?? '';
    const invite = await prisma.messagesInvite.findUnique({
      where: { token },
      include: { user: { select: { email: true, displayName: true, username: true } } },
    });
    if (!invite || invite.revokedAt || invite.usedAt || invite.expiresAt < new Date()) {
      return { valid: false };
    }
    // Mask the email: ab•••@domain
    const [local, domain] = invite.user.email.split('@');
    const masked = `${local.slice(0, 2)}•••@${domain}`;
    return { valid: true, email: masked, suggestedName: invite.user.displayName || invite.user.username };
  });
}
