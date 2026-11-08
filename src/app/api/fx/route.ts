import { getFx } from '@/lib/fx';
import { api } from '@/lib/api';

export async function GET() {
  return api(async () => await getFx());
}
