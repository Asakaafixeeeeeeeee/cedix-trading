import { clearSessionCookie } from '@/lib/auth';
import { api } from '@/lib/api';

export async function POST() {
  return api(async () => {
    await clearSessionCookie();
    return { ok: true };
  });
}
