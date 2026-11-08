import { requireUser } from '@/lib/auth';
import { subscribe } from '@/lib/earn';
import { api } from '@/lib/api';

export async function POST(req: Request) {
  return api(async () => {
    const user = await requireUser();
    const { productId, amount } = await req.json();
    const position = await subscribe(user.id, productId, Number(amount));
    return { position };
  });
}
