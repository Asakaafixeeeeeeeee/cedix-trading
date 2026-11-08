import { requireElevatedAdmin, getIp } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

export async function GET() {
  return api(async () => {
    await requireElevatedAdmin();
    const banners = await prisma.banner.findMany({ orderBy: { sort: 'asc' } });
    return { banners };
  });
}

export async function POST(req: Request) {
  return api(async () => {
    const admin = await requireElevatedAdmin();
    const { title, body, link, active, sort } = await req.json();
    if (!title || !body) throw new Error('Title and body are required');
    const banner = await prisma.banner.create({
      data: { title, body, link: link || null, active: active !== false, sort: Number(sort) || 0 },
    });
    await prisma.auditLog.create({
      data: { adminId: admin.id, action: 'banner.create', targetType: 'BANNER', targetId: banner.id, ip: getIp(req) },
    });
    return { banner };
  });
}
