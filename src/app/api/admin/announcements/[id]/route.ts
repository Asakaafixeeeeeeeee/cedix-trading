import { requireElevatedAdmin, getIp } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const admin = await requireElevatedAdmin();
    const { id } = await ctx.params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
    if ('body' in body) data.body = body.body ? String(body.body) : null;
    if (typeof body.published === 'boolean') data.published = body.published;
    if (typeof body.pinned === 'boolean') data.pinned = body.pinned;
    if (body.publishAt) data.publishAt = new Date(body.publishAt);
    const announcement = await prisma.announcement.update({ where: { id }, data });
    await prisma.auditLog.create({
      data: { adminId: admin.id, action: 'announcement.update', targetType: 'ANNOUNCEMENT', targetId: id, meta: data as object, ip: getIp(req) },
    });
    return { announcement };
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const admin = await requireElevatedAdmin();
    const { id } = await ctx.params;
    await prisma.announcement.delete({ where: { id } });
    await prisma.auditLog.create({
      data: { adminId: admin.id, action: 'announcement.delete', targetType: 'ANNOUNCEMENT', targetId: id, ip: getIp(req) },
    });
    return { ok: true };
  });
}
