import { getCurrentUser } from '@/lib/auth';
import { api } from '@/lib/api';

export async function GET() {
  return api(async () => {
    const user = await getCurrentUser();
    if (!user) return { user: null };
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
        kycLevel: user.kycLevel,
        orbitBanned: user.orbitBanned,
        createdAt: user.createdAt,
      },
    };
  });
}
