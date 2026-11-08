import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { api } from '@/lib/api';

/** Complete a password reset using the emailed token. */
export async function POST(req: Request) {
  return api(async () => {
    const { email, token, password } = await req.json();
    const addr = String(email ?? '').trim().toLowerCase();
    if (!token) throw new Error('Reset token required');
    if (!password || String(password).length < 8) throw new Error('Password must be at least 8 characters');

    const code = await prisma.verificationCode.findFirst({
      where: { email: `reset:${addr}`, used: false, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!code || code.attempts >= 5) throw new Error('This reset link is invalid or has expired');

    const ok = await bcrypt.compare(String(token), code.codeHash);
    if (!ok) {
      await prisma.verificationCode.update({ where: { id: code.id }, data: { attempts: { increment: 1 } } });
      throw new Error('This reset link is invalid or has expired');
    }

    const user = await prisma.user.findUnique({ where: { email: addr } });
    if (!user) throw new Error('This reset link is invalid or has expired');

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(String(password)) } }),
      prisma.verificationCode.update({ where: { id: code.id }, data: { used: true } }),
    ]);
    return { ok: true };
  });
}
