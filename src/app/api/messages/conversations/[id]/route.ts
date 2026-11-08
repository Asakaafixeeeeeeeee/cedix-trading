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
      include: {
        sender: { select: { name: true, avatarType: true, letter: true, allowReplies: true, disabled: true } },
        messages: { orderBy: { createdAt: 'asc' }, take: 300 },
      },
    });
    if (!conversation || conversation.userId !== user.id) throw new Error('Conversation not found');
    return {
      conversation: {
        id: conversation.id,
        name: conversation.sender?.name ?? conversation.name,
        system: conversation.system,
        sender: conversation.sender
          ? {
              name: conversation.sender.name,
              avatarType: conversation.sender.avatarType,
              letter: conversation.sender.letter,
              allowReplies: conversation.sender.allowReplies && !conversation.sender.disabled,
            }
          : null,
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

/** Send a reply — only when the admin enabled replies for this sender. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const { user } = await requireMessagesUser();
    const { id } = await ctx.params;
    const { body } = await req.json();
    const text = String(body ?? '').trim();
    if (!text || text.length > 2000) throw new Error('Message must be 1-2000 characters');

    const conversation = await prisma.conversation.findUnique({ where: { id }, include: { sender: true } });
    if (!conversation || conversation.userId !== user.id) throw new Error('Conversation not found');
    if (!conversation.sender?.allowReplies || conversation.sender.disabled) {
      throw new Error('This conversation is read-only');
    }

    const message = await prisma.message.create({
      data: { conversationId: id, sender: 'USER', body: text, readAt: new Date() },
    });
    await prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
    return { message };
  });
}
