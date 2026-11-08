import { api } from '@/lib/api';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';
import { setMessagesSession } from '@/lib/messagesAuth';

/** Messages app login — separate from the CediX Trading session. */
export async function POST(req: Request) {
  return api(async () => {
    const { email, password } = await req.json();
    if (!email || !password) throw new Error('Email and password are required');

    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase() },
      include: { messagesAccount: true },
    });
    const account = user?.messagesAccount;
    // One generic error — don't reveal which part failed.
    const fail = () => new Error('Invalid email or password, or no Messages access');
    if (!user || !account || !account.registeredAt || !account.passwordHash) throw fail();
    if (account.suspended || user.status === 'BLOCKED') throw new Error('This Messages account has been suspended');
    if (!(await verifyPassword(password, account.passwordHash))) throw fail();

    await setMessagesSession(user.id);
    return { ok: true, displayName: account.displayName };
  });
}
