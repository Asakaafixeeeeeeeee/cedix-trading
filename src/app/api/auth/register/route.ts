import { prisma } from '@/lib/db';
import { hashPassword, setSessionCookie } from '@/lib/auth';
import { api } from '@/lib/api';

export async function POST(req: Request) {
  return api(async () => {
    const { email, username, password, phone } = await req.json();
    if (!email || !username || !password) throw new Error('Email, username and password are required');
    if (String(password).length < 8) throw new Error('Password must be at least 8 characters');
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) throw new Error('Username must be 3-20 chars (letters, numbers, _)');
    const exists = await prisma.user.findFirst({
      where: { OR: [{ email: email.toLowerCase() }, { username }] },
    });
    if (exists) throw new Error('Email or username already in use');
    const user = await prisma.user.create({
      data: {
        email: String(email).toLowerCase(),
        username,
        phone: phone || null,
        passwordHash: await hashPassword(password),
        displayName: username,
      },
    });
    await setSessionCookie(user.id, user.role);
    return { id: user.id, email: user.email, username: user.username, role: user.role };
  });
}
