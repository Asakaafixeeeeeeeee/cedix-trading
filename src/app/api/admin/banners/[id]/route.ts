import { requireElevatedAdmin, getIp } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const admin = await requireElevatedAdmin();
    const { id } = await ctx.params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.title === 'string') data.title = body.title;
    if (typeof body.body === 'string') data.body = body.body;
    if ('link' in body) data.link = body.link || null;
    if (typeof body.active === 'boolean') data.active = body.active;
    if ('sort' in body) data.sort = Number(body.sort) || 0;
    const banner = await prisma.banner.update({ where: { id }, data });
    await prisma.auditLog.create({
      data: { adminId: admin.id, action: 'banner.update', targetType: 'BANNER', targetId: id, meta: data as object, ip: getIp(req) },
    });
    return { banner };
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const admin = await requireElevatedAdmin();
    const { id } = await ctx.params;
    await prisma.banner.delete({ where: { id } });
    await prisma.auditLog.create({
      data: { adminId: admin.id, action: 'banner.delete', targetType: 'BANNER', targetId: id, ip: getIp(req) },
    });
    return { ok: true };
  });
}
