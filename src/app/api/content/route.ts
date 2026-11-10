import { api } from '@/lib/api';
import { getContentMap } from '@/lib/content';

/** Public key→value map of all editable copy (defaults + admin overrides). */
export async function GET() {
  return api(async () => {
    const content = await getContentMap();
    return { content };
  });
}
