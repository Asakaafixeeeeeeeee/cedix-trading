import { NextResponse } from 'next/server';
import { getCurrentUser, isElevated } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

/** Serve a private KYC document — only to its owner or an elevated admin. */
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { name } = await ctx.params;
  const safe = path.basename(name); // prevent traversal
  const ext = path.extname(safe).toLowerCase();
  if (!(ext in MIME)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const kyc = await prisma.kycApplication.findFirst({
    where: { OR: [{ docFront: safe }, { docBack: safe }, { selfie: safe }] },
  });
  if (!kyc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isOwner = kyc.userId === user.id;
  const isAdminElevated = user.role === 'ADMIN' && (await isElevated(user.id));
  if (!isOwner && !isAdminElevated) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const buf = await readFile(path.join(process.cwd(), 'private-uploads', safe));
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': MIME[ext], 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
