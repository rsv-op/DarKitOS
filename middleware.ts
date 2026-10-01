import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  roleFromEmployeeCode,
  roleFromToken,
} from "@/lib/auth";

function getRole(
  request: NextRequest,
) {
  const employeeCode =
    request.cookies.get(
      "employee_code",
    )?.value;

  const employeeRole =
    roleFromEmployeeCode(employeeCode);

  if (employeeRole) {
    return employeeRole;
  }

  const token =
    request.cookies.get(
      "dark_cloud_session",
    )?.value;

  return roleFromToken(token);
}

function unauthorized() {
  return NextResponse.json(
    {
      success: false,
      error: "Authentication required",
    },
    { status: 401 },
  );
}

export function middleware(
  request: NextRequest,
) {
  const pathname =
    request.nextUrl.pathname;

  const role = getRole(request);

  /*
   * API authentication
   */
  if (pathname.startsWith("/api/")) {
    if (pathname === "/api/login") {
      return NextResponse.next();
    }

    if (!role) {
      return unauthorized();
    }

    return NextResponse.next();
  }

  /*
   * Developer console
   */
  if (pathname.startsWith("/dev")) {
    if (role !== "developer") {
      return NextResponse.redirect(
        new URL("/login", request.url),
      );
    }

    return NextResponse.next();
  }

  /*
   * Owner
   */
  if (pathname.startsWith("/owner")) {
    if (
      role !== "owner" &&
      role !== "developer"
    ) {
      return NextResponse.redirect(
        new URL("/login", request.url),
      );
    }

    return NextResponse.next();
  }

  /*
   * Cook
   */
  if (pathname.startsWith("/cook")) {
    if (
      role !== "cook" &&
      role !== "developer"
    ) {
      return NextResponse.redirect(
        new URL("/login", request.url),
      );
    }

    return NextResponse.next();
  }

  /*
   * Dispatch
   */
  if (pathname.startsWith("/dispatch")) {
    if (
      role !== "dispatch" &&
      role !== "developer"
    ) {
      return NextResponse.redirect(
        new URL("/login", request.url),
      );
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dev/:path*",
    "/cook/:path*",
    "/dispatch/:path*",
    "/owner/:path*",
    "/api/:path*",
  ],
};
