// Server-side Content Management resolver. Pure registry lives in
// content-defaults.ts (client-safe); this file adds DB overrides + caching.
// Financial maths, credentials and security logic are NEVER resolved here.

import { prisma } from './db';
import { CONTENT, type ContentKey } from './content-defaults';

export { CONTENT };
export type { ContentKey, ContentCategory, ContentDef } from './content-defaults';

// Short in-memory cache so hot paths don't hit the DB on every render.
let cache: { map: Record<string, string>; at: number } | null = null;
const TTL_MS = 10_000;

export function invalidateContentCache() {
  cache = null;
}

function isKnown(key: string): key is ContentKey {
  return Object.prototype.hasOwnProperty.call(CONTENT, key);
}

/** Resolve the full key→value map: defaults overlaid with admin overrides. */
export async function getContentMap(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  const map: Record<string, string> = {};
  for (const [key, def] of Object.entries(CONTENT)) map[key] = def.default;
  try {
    const rows = await prisma.contentEntry.findMany();
    for (const r of rows) if (isKnown(r.key)) map[r.key] = r.value;
  } catch {
    /* table may not exist during first boot — defaults are fine */
  }
  cache = { map, at: Date.now() };
  return map;
}

/** Server-side single-key resolver. */
export async function getContent(key: ContentKey): Promise<string> {
  const map = await getContentMap();
  return map[key] ?? CONTENT[key]?.default ?? '';
}
