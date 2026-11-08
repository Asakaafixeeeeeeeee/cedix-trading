import { api } from '@/lib/api';
import { getMessagesUser } from '@/lib/messagesAuth';

export async function GET() {
  return api(async () => {
    const mu = await getMessagesUser();
    if (!mu) return { user: null };
    return { user: { displayName: mu.account.displayName, email: mu.user.email } };
  });
}
