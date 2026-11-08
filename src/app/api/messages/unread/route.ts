import { api } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireMessagesUser } from '@/lib/messagesAuth';

/** Total unread count (for app badge / polling). */
export async function GET() {
  return api(async () => {
    const { user } = await requireMessagesUser();
    const unread = await prisma.message.count({
      where: { conversation: { userId: user.id }, readAt: null, sender: 'SYSTEM' },
    });
    return { unread };
  });
}
