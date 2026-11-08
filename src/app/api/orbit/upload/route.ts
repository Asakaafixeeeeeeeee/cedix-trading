import { requireUser } from '@/lib/auth';
import { api } from '@/lib/api';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
const VIDEO_TYPES: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};
const MAX_IMAGE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO = 100 * 1024 * 1024; // 100 MB

/** Upload images/videos for Orbit posts. */
export async function POST(req: Request) {
  return api(async () => {
    const user = await requireUser();
    if (user.orbitBanned) throw new Error('You are blocked from Orbit');
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new Error('file required');

    const isImage = file.type in IMAGE_TYPES;
    const isVideo = file.type in VIDEO_TYPES;
    if (!isImage && !isVideo) throw new Error('Only JPEG/PNG/WebP/GIF images or MP4/WebM videos allowed');
    if (isImage && file.size > MAX_IMAGE) throw new Error('Image too large (max 10 MB)');
    if (isVideo && file.size > MAX_VIDEO) throw new Error('Video too large (max 100 MB)');

    const ext = isImage ? IMAGE_TYPES[file.type] : VIDEO_TYPES[file.type];
    const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    const dir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));

    return { url: `/uploads/${name}`, mediaType: isVideo ? 'video' : 'image' };
  });
}
