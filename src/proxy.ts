import { NextResponse, type NextRequest } from 'next/server';

/** Sends phone users landing on the desktop homepage to the mobile app. */
export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === '/') {
    const ua = req.headers.get('user-agent') ?? '';
    const isPhone = /Android.*Mobile|iPhone|iPod|Windows Phone/i.test(ua);
    if (isPhone) {
      return NextResponse.redirect(new URL('/m', req.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/'],
};
