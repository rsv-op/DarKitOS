
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isCookRoute = path.startsWith('/cook');
  const isDispatchRoute = path.startsWith('/dispatch');
  const isOwnerRoute = path.startsWith('/owner');

  // Allow public routes, static assets, and auth endpoints through
  if (!isCookRoute && !isDispatchRoute && !isOwnerRoute) {
    return NextResponse.next();
  }

  // Check for active station PIN token or session cookie
  const pinCookie = request.cookies.get('kitchen_pin')?.value || request.cookies.get('dark_cloud_session')?.value;

  // Redirect unauthenticated traffic to the universal PIN gateway
  if (!pinCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Master Dev Bypass grants top-level access across all station views
  if (pinCookie === 'dev_token' || pinCookie.endsWith('_9999')) {
    return NextResponse.next();
  }

  // Strict role isolation per station route
  if (isCookRoute && !pinCookie.includes('cook')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isDispatchRoute && !pinCookie.includes('dispatch')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isOwnerRoute && !pinCookie.includes('owner')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/cook/:path*', '/dispatch/:path*', '/owner/:path*'],
};
