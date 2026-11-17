import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { findEmployeeByCode, verifyToken } from "./lib/auth";

const PUBLIC_ROUTES = [
  "/login",
  "/api/login",
  "/api/auth/login",
  "/api/session",
];

const STATIC_ASSETS = [
  "/_next",
  "/assets",
  "/favicon.ico",
];

export async function middleware(
  request: NextRequest,
) {
  const { pathname } = request.nextUrl;

  if (
    STATIC_ASSETS.some((path) =>
      pathname.startsWith(path),
    ) ||
    PUBLIC_ROUTES.some(
      (route) => pathname === route,
    )
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(
    "dark_cloud_session",
  )?.value;
  const empCode = request.cookies.get(
    "employee_code",
  )?.value;

  let session = token
    ? await verifyToken(token)
    : null;

  if (!session && empCode) {
    const emp = findEmployeeByCode(empCode);
    if (emp) {
      session = {
        userId: emp.id,
        employeeCode: emp.employeeCode,
        name: emp.name,
        role: emp.role,
        kitchenId: emp.kitchenId,
      };
    }
  }

  // Root router: send users to Command Center (or role-specific station if logged in)
  if (pathname === "/") {
    if (session) {
      switch (session.role) {
        case "OWNER":
        case "MANAGER":
          return NextResponse.redirect(
            new URL("/dashboard", request.url),
          );
        case "LINE_COOK":
          return NextResponse.redirect(
            new URL("/kds", request.url),
          );
        case "DISPATCH":
          return NextResponse.redirect(
            new URL("/dispatch", request.url),
          );
      }
    }
    return NextResponse.redirect(
      new URL("/dashboard", request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
