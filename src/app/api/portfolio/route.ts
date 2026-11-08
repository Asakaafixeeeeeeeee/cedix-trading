import { requireUser } from '@/lib/auth';
import { getPortfolio } from '@/lib/wallet';
import { api } from '@/lib/api';

export async function GET() {
  return api(async () => {
    const user = await requireUser();
    return await getPortfolio(user.id);
  });
}
