import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { sendMail, mailerConfigured } from '@/lib/mailer';
import { sendEmail, emailHtml, emailEnabled } from '@/lib/email';
import { api } from '@/lib/api';

/**
 * Send a 6-digit email verification code (10-minute expiry).
 * Delivery order: Resend (preferred) → SMTP → sandbox (code shown in the UI
 * with a clear notice so development flows stay fully functional).
 */
export async function POST(req: Request) {
  return api(async () => {
    const { email } = await req.json();
    const addr = String(email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) throw new Error('Enter a valid email address');

    const existing = await prisma.user.findUnique({ where: { email: addr } });
    if (existing) throw new Error('An account with this email already exists');

    // simple rate limit: max 3 codes per 10 minutes per email
    const recent = await prisma.verificationCode.count({
      where: { email: addr, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
    });
    if (recent >= 3) throw new Error('Too many codes requested. Try again later.');

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await prisma.verificationCode.create({
      data: {
        email: addr,
        codeHash: await bcrypt.hash(code, 8),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    if (emailEnabled()) {
      const result = await sendEmail({
        to: addr,
        subject: 'Your CediX verification code',
        template: 'email_verification',
        html: emailHtml('Email verification', [
          `Your CediX verification code is:`,
          `<span style="font-size:24px;font-weight:700;letter-spacing:6px">${code}</span>`,
          'It expires in 10 minutes. If you did not request this, you can ignore this email.',
        ]),
      });
      if (result === 'SENT') return { sent: true };
      // fall through to SMTP / sandbox so registration never breaks
    }

    const sent = await sendMail(
      addr,
      'Your CediX verification code',
      `Your CediX verification code is ${code}. It expires in 10 minutes.`,
    );

    if (sent) return { sent: true };
    // Sandbox: no SMTP configured — surface the code with a clear notice
    return { sent: false, sandbox: true, code, notice: 'Email service not configured — sandbox code shown.' };
  });
}
