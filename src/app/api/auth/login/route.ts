import { prisma } from '@/lib/db';
import { verifyPassword, setSessionCookie, AuthError, getIp } from '@/lib/auth';
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
    if (user.role === 'ADMIN') {
      await prisma.auditLog.create({
        data: { adminId: user.id, action: 'admin.login', ip: getIp(req) },
      });
    }
    await setSessionCookie(user.id, user.role);
    return { id: user.id, email: user.email, username: user.username, role: user.role };
  });
}
