import { api } from '@/lib/api';
import { getVapidKeys } from '@/lib/notify';
import { requireMessagesUser } from '@/lib/messagesAuth';

/** Public VAPID key for push subscription (authenticated users only). */
export async function GET() {
  return api(async () => {
    await requireMessagesUser();
    const keys = await getVapidKeys();
    return { publicKey: keys.publicKey };
  });
}
