import { requireUser } from '@/lib/auth';
import { redeem } from '@/lib/earn';
import { api } from '@/lib/api';

export async function POST(req: Request) {
  return api(async () => {
    const user = await requireUser();
    const { positionId } = await req.json();
    return await redeem(user.id, positionId);
  });
}
