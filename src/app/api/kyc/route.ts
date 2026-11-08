import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { api } from '@/lib/api';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const TYPES: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const MAX_SIZE = 8 * 1024 * 1024;

async function saveDoc(file: File, prefix: string): Promise<string> {
  if (!(file.type in TYPES)) throw new Error('Documents must be JPEG, PNG or WebP images');
  if (file.size > MAX_SIZE) throw new Error('Each image must be under 8 MB');
  const name = `${prefix}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${TYPES[file.type]}`;
  const dir = path.join(process.cwd(), 'private-uploads');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

/** Current user's verification status. */
export async function GET() {
  return api(async () => {
    const user = await requireUser();
    const kyc = await prisma.kycApplication.findUnique({ where: { userId: user.id } });
    return {
      kyc: kyc
        ? { status: kyc.status, note: kyc.note, idType: kyc.idType, legalName: kyc.legalName, updatedAt: kyc.updatedAt }
        : null,
      kycLevel: user.kycLevel,
    };
  });
}

/**
 * Submit an identity verification application (Ghana Card or passport):
 * personal details + front/back document images + live camera selfie.
 * Documents are stored privately and reviewed by compliance staff.
 */
export async function POST(req: Request) {
  return api(async () => {
    const user = await requireUser();
    const existing = await prisma.kycApplication.findUnique({ where: { userId: user.id } });
    if (existing && ['PENDING', 'APPROVED'].includes(existing.status)) {
      throw new Error(existing.status === 'APPROVED' ? 'You are already verified' : 'Your application is already under review');
    }

    const form = await req.formData();
    const legalName = String(form.get('legalName') ?? '').trim();
    const dob = String(form.get('dob') ?? '');
    const country = String(form.get('country') ?? 'GH');
    const address = String(form.get('address') ?? '').trim();
    const idType = String(form.get('idType') ?? 'GHANA_CARD');
    const idNumber = String(form.get('idNumber') ?? '').trim();
    const docFront = form.get('docFront');
    const docBack = form.get('docBack');
    const selfie = form.get('selfie');

    if (legalName.length < 3) throw new Error('Enter your full legal name');
    const dobDate = new Date(dob);
    if (isNaN(dobDate.getTime())) throw new Error('Enter a valid date of birth');
    const age = (Date.now() - dobDate.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (age < 18) throw new Error('You must be at least 18 years old');
    if (age > 120) throw new Error('Enter a valid date of birth');
    if (address.length < 5) throw new Error('Enter your residential address');
    if (idType === 'GHANA_CARD' && !/^GHA-\d{9}-\d$/i.test(idNumber)) {
      throw new Error('Ghana Card number must be in the format GHA-XXXXXXXXX-X');
    }
    if (idNumber.length < 5) throw new Error('Enter a valid ID number');
    if (!(docFront instanceof File) || !(docBack instanceof File) || !(selfie instanceof File)) {
      throw new Error('Front image, back image and live selfie are all required');
    }

    const [frontPath, backPath, selfiePath] = await Promise.all([
      saveDoc(docFront, 'front'),
      saveDoc(docBack, 'back'),
      saveDoc(selfie, 'selfie'),
    ]);

    const data = {
      legalName,
      dob: dobDate,
      country,
      address,
      idType,
      idNumber: idNumber.toUpperCase(),
      docFront: frontPath,
      docBack: backPath,
      selfie: selfiePath,
      status: 'PENDING' as const,
      note: null,
      reviewedBy: null,
    };
    const kyc = existing
      ? await prisma.kycApplication.update({ where: { userId: user.id }, data })
      : await prisma.kycApplication.create({ data: { userId: user.id, ...data } });

    return { kyc: { status: kyc.status } };
  });
}
