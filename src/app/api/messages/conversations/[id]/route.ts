import { api } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireMessagesUser } from '@/lib/messagesAuth';

/** Full message history for one of the user's own conversations. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const { user } = await requireMessagesUser();
    const { id } = await ctx.params;
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 300 } },
    });
    if (!conversation || conversation.userId !== user.id) throw new Error('Conversation not found');
    return {
      conversation: {
        id: conversation.id,
        name: conversation.name,
        system: conversation.system,
        messages: conversation.messages.map((m) => ({
          id: m.id,
          sender: m.sender,
          title: m.title,
          body: m.body,
          meta: m.meta,
          readAt: m.readAt,
          createdAt: m.createdAt,
        })),
      },
    };
  });
}

/** Mark all messages in the conversation as read. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const { user } = await requireMessagesUser();
    const { id } = await ctx.params;
    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation || conversation.userId !== user.id) throw new Error('Conversation not found');
    await prisma.message.updateMany({
      where: { conversationId: id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  });
}
