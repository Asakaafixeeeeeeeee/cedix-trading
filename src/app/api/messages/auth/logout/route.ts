import { api } from '@/lib/api';
import { clearMessagesSession } from '@/lib/messagesAuth';

export async function POST() {
  return api(async () => {
    await clearMessagesSession();
    return { ok: true };
  });
}
