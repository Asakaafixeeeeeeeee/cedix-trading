import { api } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireMessagesUser } from '@/lib/messagesAuth';

/** Register (or refresh) a device push subscription. */
export async function POST(req: Request) {
  return api(async () => {
    const { user } = await requireMessagesUser();
    const { subscription, userAgent } = await req.json();
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;
    if (!endpoint || !p256dh || !auth) throw new Error('Invalid push subscription');

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: user.id, p256dh, auth, userAgent: userAgent?.slice(0, 200) ?? null },
      create: { userId: user.id, endpoint, p256dh, auth, userAgent: userAgent?.slice(0, 200) ?? null },
    });
    return { ok: true };
  });
}

/** Remove a device push subscription. */
export async function DELETE(req: Request) {
  return api(async () => {
    const { user } = await requireMessagesUser();
    const { endpoint } = await req.json();
    if (endpoint) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
    }
    return { ok: true };
  });
}
