import { requireElevatedAdmin, getIp } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';
import { CONTENT, getContentMap, invalidateContentCache, type ContentKey, type ContentDef } from '@/lib/content';

function isKnown(key: string): key is ContentKey {
  return Object.prototype.hasOwnProperty.call(CONTENT, key);
}

const REGISTRY = CONTENT as Record<string, ContentDef>;

/** List every editable string: default, current value, category, label, and
 * whether a prior version exists to restore. */
export async function GET() {
  return api(async () => {
    await requireElevatedAdmin();
    const [map, versionKeys] = await Promise.all([
      getContentMap(),
      prisma.contentVersion.findMany({ select: { key: true }, distinct: ['key'] }),
    ]);
    const hasHistory = new Set(versionKeys.map((v) => v.key));
    const entries = Object.entries(REGISTRY).map(([key, def]) => ({
      key,
      category: def.category,
      label: def.label,
      multiline: Boolean(def.multiline),
      default: def.default,
      value: map[key] ?? def.default,
      overridden: (map[key] ?? def.default) !== def.default,
      hasHistory: hasHistory.has(key),
    }));
    const categories = [...new Set(entries.map((e) => e.category))];
    return { entries, categories };
  });
}

/**
 * Content actions:
 *  - { action: 'save', key, value }  → store override, push previous to history
 *  - { action: 'reset', key }        → remove override, back to source default
 *  - { action: 'restore', key }      → restore the most recent previous version
 */
export async function POST(req: Request) {
  return api(async () => {
    const admin = await requireElevatedAdmin();
    const ip = getIp(req);
    const { action, key, value } = await req.json();
    if (!isKnown(String(key))) throw new Error('Unknown content key');
    const def = REGISTRY[key as ContentKey];

    if (action === 'save') {
      const next = String(value ?? '');
      if (next.length > 5000) throw new Error('Text is too long (max 5000 characters)');
      const existing = await prisma.contentEntry.findUnique({ where: { key } });
      const prev = existing?.value ?? def.default;
      await prisma.$transaction(async (db) => {
        // Keep the value being replaced as a restorable version.
        if (prev !== next) {
          await db.contentVersion.create({ data: { key, value: prev, createdBy: admin.id } });
        }
        await db.contentEntry.upsert({
          where: { key },
          update: { value: next, updatedBy: admin.id },
          create: { key, value: next, updatedBy: admin.id },
        });
      });
      await prisma.auditLog.create({ data: { adminId: admin.id, action: 'content.save', targetType: 'CONTENT', targetId: key, ip } });
      invalidateContentCache();
      return { ok: true, value: next };
    }

    if (action === 'reset') {
      const existing = await prisma.contentEntry.findUnique({ where: { key } });
      if (existing) {
        await prisma.contentVersion.create({ data: { key, value: existing.value, createdBy: admin.id } });
        await prisma.contentEntry.delete({ where: { key } });
      }
      await prisma.auditLog.create({ data: { adminId: admin.id, action: 'content.reset', targetType: 'CONTENT', targetId: key, ip } });
      invalidateContentCache();
      return { ok: true, value: def.default };
    }

    if (action === 'restore') {
      const last = await prisma.contentVersion.findFirst({ where: { key }, orderBy: { createdAt: 'desc' } });
      if (!last) throw new Error('No previous version to restore');
      await prisma.$transaction(async (db) => {
        await db.contentEntry.upsert({
          where: { key },
          update: { value: last.value, updatedBy: admin.id },
          create: { key, value: last.value, updatedBy: admin.id },
        });
        await db.contentVersion.delete({ where: { id: last.id } });
      });
      await prisma.auditLog.create({ data: { adminId: admin.id, action: 'content.restore', targetType: 'CONTENT', targetId: key, ip } });
      invalidateContentCache();
      return { ok: true, value: last.value };
    }

    throw new Error('Unknown action');
  });
}
