import { api } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireMessagesUser } from '@/lib/messagesAuth';

/** Conversation list with preview + unread counts (own conversations only). */
export async function GET() {
  return api(async () => {
    const { user } = await requireMessagesUser();
    const conversations = await prisma.conversation.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        sender: { select: { name: true, avatarType: true, letter: true, disabled: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { title: true, body: true, createdAt: true } },
        _count: { select: { messages: { where: { readAt: null, sender: 'SYSTEM' } } } },
      },
    });
    return {
      conversations: conversations
        .filter((c) => !c.sender?.disabled)
        .map((c) => ({
          id: c.id,
          name: c.sender?.name ?? c.name,
          system: c.system,
          sender: c.sender ? { name: c.sender.name, avatarType: c.sender.avatarType, letter: c.sender.letter } : null,
          last: c.messages[0] ?? null,
          unread: c._count.messages,
        })),
    };
  });
}
