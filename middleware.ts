import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  const isCookRoute = path.startsWith('/cook')
  const isDispatchRoute = path.startsWith('/dispatch')
  const isOwnerRoute = path.startsWith('/owner')

  // Let public routes through
  if (!isCookRoute && !isDispatchRoute && !isOwnerRoute) {
    return NextResponse.next()
  }

  const pinCookie = request.cookies.get('kitchen_pin')?.value

  // Redirect to login if no PIN exists
  if (!pinCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Master Dev Bypass - full access to everything
  if (pinCookie === 'dev_token') {
    return NextResponse.next()
  }

  // Strict Role Enforcement for standard users
  if (isCookRoute && pinCookie !== 'cook_token') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (isDispatchRoute && pinCookie !== 'dispatch_token') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (isOwnerRoute && pinCookie !== 'owner_token') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/cook/:path*', '/dispatch/:path*', '/owner/:path*'],
}
