import { prisma } from '@/lib/db';
import { verifyPassword, setSessionCookie, AuthError } from '@/lib/auth';
import { api } from '@/lib/api';

export async function POST(req: Request) {
  return api(async () => {
    const { identifier, password } = await req.json();
    if (!identifier || !password) throw new Error('Missing credentials');
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: String(identifier).toLowerCase() }, { username: identifier }] },
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new AuthError('Invalid credentials', 401);
    }
    if (user.status === 'BLOCKED') throw new AuthError('Account blocked', 403);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await setSessionCookie(user.id, user.role);
    return { id: user.id, email: user.email, username: user.username, role: user.role };
  });
}
