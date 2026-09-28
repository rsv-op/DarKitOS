import { NextRequest, NextResponse } from "next/server";

import {
  EMPLOYEES_DB,
  ROLE_PERMISSIONS_DB,
} from "@/lib/db";

const PROTECTED_ROUTES = [
  "/cook",
  "/dispatch",
  "/owner",
] as const;

function getEmployeeFromRequest(
  request: NextRequest
) {
  const employeeCode =
    request.cookies.get(
      "employee_code"
    )?.value;

  if (!employeeCode) {
    return undefined;
  }

  return EMPLOYEES_DB.find(
    (employee) =>
      employee.active &&
      employee.employeeCode ===
        employeeCode
  );
}

function hasPermission(
  role: (typeof EMPLOYEES_DB)[number]["role"],
  permissionId: string
): boolean {
  return ROLE_PERMISSIONS_DB.some(
    (mapping) =>
      mapping.role === role &&
      mapping.permissionId ===
        permissionId
  );
}

function getRequiredPermission(
  pathname: string
): string | null {
  if (
    pathname === "/owner" ||
    pathname.startsWith("/owner/")
  ) {
    return "PERM-OWNER-VIEW";
  }

  if (
    pathname === "/cook" ||
    pathname.startsWith("/cook/")
  ) {
    return "PERM-COOK-ORDERS";
  }

  if (
    pathname === "/dispatch" ||
    pathname.startsWith("/dispatch/")
  ) {
    return "PERM-DISPATCH-ORDERS";
  }

  return null;
}

function isProtectedRoute(
  pathname: string
): boolean {
  return PROTECTED_ROUTES.some(
    (route) =>
      pathname === route ||
      pathname.startsWith(
        `${route}/`
      )
  );
}

function redirectToLogin(
  request: NextRequest
): NextResponse {
  const loginUrl =
    new URL(
      "/login",
      request.url
    );

  loginUrl.searchParams.set(
    "redirect",
    request.nextUrl.pathname
  );

  return NextResponse.redirect(
    loginUrl
  );
}

export function middleware(
  request: NextRequest
) {
  const { pathname } =
    request.nextUrl;

  if (
    pathname === "/login" ||
    pathname.startsWith(
      "/api/login"
    )
  ) {
    return NextResponse.next();
  }

  if (
    !isProtectedRoute(pathname)
  ) {
    return NextResponse.next();
  }

  const employee =
    getEmployeeFromRequest(
      request
    );

  if (!employee) {
    return redirectToLogin(
      request
    );
  }

  const requiredPermission =
    getRequiredPermission(
      pathname
    );

  if (
    requiredPermission &&
    !hasPermission(
      employee.role,
      requiredPermission
    )
  ) {
    return new NextResponse(
      "Forbidden",
      {
        status: 403,
        headers: {
          "Content-Type":
            "text/plain; charset=utf-8",
        },
      }
    );
  }

  if (
    employee.role !== "OWNER" &&
    !employee.kitchenId
  ) {
    return new NextResponse(
      "Kitchen assignment required",
      {
        status: 403,
        headers: {
          "Content-Type":
            "text/plain; charset=utf-8",
        },
      }
    );
  }

  const response =
    NextResponse.next();

  response.headers.set(
    "x-employee-id",
    employee.id
  );

  response.headers.set(
    "x-employee-code",
    employee.employeeCode
  );

  response.headers.set(
    "x-employee-role",
    employee.role
  );

  if (employee.kitchenId) {
    response.headers.set(
      "x-kitchen-id",
      employee.kitchenId
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/cook/:path*",
    "/dispatch/:path*",
    "/owner/:path*",
    "/login",
    "/api/login",
  ],
};
