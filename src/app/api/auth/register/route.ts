import { prisma } from '@/lib/db';
import { hashPassword, setSessionCookie } from '@/lib/auth';
import { verifyEmailCode } from '@/lib/verification';
import { api } from '@/lib/api';
import { sendEmail, emailHtml } from '@/lib/email';

export async function POST(req: Request) {
  return api(async () => {
    const { email, username, password, phone, country, code } = await req.json();
    if (!email || !username || !password) throw new Error('Email, username and password are required');
    if (String(password).length < 8) throw new Error('Password must be at least 8 characters');
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) throw new Error('Username must be 3-20 chars (letters, numbers, _)');

    const addr = String(email).toLowerCase();
    if (!code || !(await verifyEmailCode(addr, String(code)))) {
      throw new Error('Invalid or expired verification code');
    }

    const exists = await prisma.user.findFirst({
      where: { OR: [{ email: addr }, { username }] },
    });
    if (exists) throw new Error('Email or username already in use');
    const user = await prisma.user.create({
      data: {
        email: addr,
        username,
        phone: phone || null,
        country: typeof country === 'string' && country.length === 2 ? country.toUpperCase() : 'GH',
        passwordHash: await hashPassword(password),
        displayName: username,
      },
    });
    await setSessionCookie(user.id, user.role);

    // Welcome email (queued honestly until the email provider is connected)
    sendEmail({
      userId: user.id,
      to: user.email,
      subject: 'Welcome to CediX Trading',
      template: 'welcome',
      html: emailHtml('Welcome to CediX Trading', [
        `Hi ${user.username}, your account has been created successfully.`,
        'You can now deposit, trade and manage your portfolio at https://cedixtrading.com.',
        'For your security, complete identity verification before making withdrawals.',
      ]),
    }).catch(() => {});

    return { id: user.id, email: user.email, username: user.username, role: user.role };
  });
}
