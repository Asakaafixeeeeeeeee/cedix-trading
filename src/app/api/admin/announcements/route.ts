import { requireElevatedAdmin, getIp } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';

export async function GET() {
  return api(async () => {
    await requireElevatedAdmin();
    const announcements = await prisma.announcement.findMany({
      orderBy: [{ pinned: 'desc' }, { publishAt: 'desc' }],
      take: 100,
    });
    return { announcements };
  });
}

export async function POST(req: Request) {
  return api(async () => {
    const admin = await requireElevatedAdmin();
    const { title, body, published, pinned, publishAt } = await req.json();
    if (!title || String(title).trim().length < 3) throw new Error('Title is required');
    const announcement = await prisma.announcement.create({
      data: {
        title: String(title).trim(),
        body: body ? String(body) : null,
        published: published !== false,
        pinned: pinned === true,
        publishAt: publishAt ? new Date(publishAt) : new Date(),
      },
    });
    await prisma.auditLog.create({
      data: { adminId: admin.id, action: 'announcement.create', targetType: 'ANNOUNCEMENT', targetId: announcement.id, ip: getIp(req) },
    });
    return { announcement };
  });
}
