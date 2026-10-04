import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./lib/auth";

const PUBLIC_ROUTES = [
  "/login",
  "/api/auth/login",
];

const STATIC_ASSETS = [
  "/_next",
  "/assets",
  "/favicon.ico",
];

export async function middleware(
  request: NextRequest
) {
  const { pathname } = request.nextUrl;

  // Bypass static files and public routes
  if (
    STATIC_ASSETS.some((path) =>
      pathname.startsWith(path)
    ) ||
    PUBLIC_ROUTES.some(
      (route) => pathname === route
    )
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(
    "dark_cloud_session"
  )?.value;

  if (!token) {
    const loginUrl = new URL(
      "/login",
      request.url
    );
    loginUrl.searchParams.set(
      "redirect",
      pathname
    );
    return NextResponse.redirect(loginUrl);
  }

  // Edge JWT verification to prevent spoofed cookies
  const session = await verifyToken(token);

  if (!session) {
    const response = NextResponse.redirect(
      new URL(
        "/login?error=session_expired",
        request.url
      )
    );
    response.cookies.delete(
      "dark_cloud_session"
    );
    return response;
  }

  // Root router: send authenticated users to their canonical station
  if (pathname === "/") {
    switch (session.role) {
      case "OWNER":
      case "MANAGER":
        return NextResponse.redirect(
          new URL("/dashboard", request.url)
        );
      case "LINE_COOK":
        return NextResponse.redirect(
          new URL("/kds", request.url)
        );
      case "DISPATCH":
        return NextResponse.redirect(
          new URL("/dispatch", request.url)
        );
      default:
        return NextResponse.redirect(
          new URL("/login", request.url)
        );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
