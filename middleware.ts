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
    pathname.startsWith("/owner")
  ) {
    return "PERM-OWNER-VIEW";
  }

  if (
    pathname.startsWith("/cook")
  ) {
    return "PERM-COOK-ORDERS";
  }

  if (
    pathname.startsWith("/dispatch")
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

export function middleware(
  request: NextRequest
) {
  const { pathname } =
    request.nextUrl;

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
    const loginUrl =
      new URL(
        "/login",
        request.url
      );

    loginUrl.searchParams.set(
      "redirect",
      pathname
    );

    return NextResponse.redirect(
      loginUrl
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

  /*
   * Owner operates across the
   * complete platform and is not
   * restricted to one kitchen.
   */
  if (
    employee.role ===
    "OWNER"
  ) {
    return NextResponse.next();
  }

  /*
   * Kitchen-scoped employees must
   * have an assigned kitchen.
   *
   * The actual kitchen filtering
   * remains the responsibility of
   * the operational API/page layer.
   */
  if (
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

  /*
   * Pass the authenticated
   * employee identity downstream
   * through request headers.
   *
   * This does not grant additional
   * permissions. It exposes the
   * already authenticated identity
   * to server-side application
   * layers.
   */
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

  if (
    employee.kitchenId
  ) {
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
  ],
};
