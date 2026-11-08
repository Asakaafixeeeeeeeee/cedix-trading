import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';
import { sendEmail, emailHtml } from '@/lib/email';

/**
 * Request a password reset link. Always answers OK (no account enumeration).
 * The link is emailed via the outbox (sends once Resend is connected).
 */
export async function POST(req: Request) {
  return api(async () => {
    const { email } = await req.json();
    const addr = String(email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) throw new Error('Enter a valid email address');

    const user = await prisma.user.findUnique({ where: { email: addr } });
    if (user) {
      // rate limit: max 3 reset links per 15 minutes
      const recent = await prisma.verificationCode.count({
        where: { email: `reset:${addr}`, createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
      });
      if (recent < 3) {
        const token = randomBytes(24).toString('base64url');
        await prisma.verificationCode.create({
          data: {
            email: `reset:${addr}`,
            codeHash: await bcrypt.hash(token, 8),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
        });
        const origin = new URL(req.url).origin;
        const link = `${origin}/reset?email=${encodeURIComponent(addr)}&token=${encodeURIComponent(token)}`;
        await sendEmail({
          userId: user.id,
          to: addr,
          subject: 'Reset your CediX Trading password',
          template: 'password_reset',
          html: emailHtml('Password reset', [
            'We received a request to reset your CediX Trading password.',
            `<a href="${link}" style="display:inline-block;background:#111;color:#fff;padding:10px 22px;border-radius:999px;text-decoration:none;font-weight:600">Reset password</a>`,
            'This link expires in 30 minutes. If you did not request a reset, you can safely ignore this email — your password stays unchanged.',
          ]),
        });
      }
    }
    return { ok: true };
  });
}
