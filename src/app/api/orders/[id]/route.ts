import { requireUser } from '@/lib/auth';
import { cancelOrder } from '@/lib/trading';
import { api } from '@/lib/api';

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const order = await cancelOrder(user.id, id);
    return { order };
  });
}
