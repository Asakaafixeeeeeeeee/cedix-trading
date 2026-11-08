import bcrypt from 'bcryptjs';
import { prisma } from './db';

/** Check a 6-digit email verification code and consume it on success. */
export async function verifyEmailCode(email: string, code: string): Promise<boolean> {
  const rows = await prisma.verificationCode.findMany({
    where: { email: email.toLowerCase(), used: false, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  for (const row of rows) {
    if (row.attempts >= 5) continue;
    if (await bcrypt.compare(code, row.codeHash)) {
      await prisma.verificationCode.update({ where: { id: row.id }, data: { used: true } });
      return true;
    }
    await prisma.verificationCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
  }
  return false;
}
