import { NextRequest, NextResponse } from "next/server";

import {
  EMPLOYEES_DB,
  type Employee,
} from "@/lib/db";

function getDefaultRoute(
  employee: Employee
): string {
  if (employee.role === "OWNER") {
    return "/owner";
  }

  if (
    employee.role === "MANAGER" ||
    employee.role === "LINE_COOK"
  ) {
    return "/cook";
  }

  if (employee.role === "DISPATCH") {
    return "/dispatch";
  }

  return "/login";
}

function canAccessRoute(
  employee: Employee,
  pathname: string
): boolean {
  if (pathname.startsWith("/owner")) {
    return employee.role === "OWNER";
  }

  if (
    pathname.startsWith("/cook") ||
    pathname.startsWith("/dispatch")
  ) {
    return Boolean(employee.kitchenId);
  }

  return true;
}

export async function POST(
  request: NextRequest
) {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          error: "Invalid login payload",
        },
        { status: 400 }
      );
    }

    const employeeCode =
      typeof body.employeeCode === "string"
        ? body.employeeCode.trim()
        : "";

    if (!employeeCode) {
      return NextResponse.json(
        {
          error: "Employee code is required",
        },
        { status: 400 }
      );
    }

    const employee =
      EMPLOYEES_DB.find(
        (item) =>
          item.active &&
          item.employeeCode.toLowerCase() ===
            employeeCode.toLowerCase()
      );

    if (!employee) {
      return NextResponse.json(
        {
          error: "Invalid employee code",
        },
        { status: 401 }
      );
    }

    const requestedRoute =
      typeof body.redirect === "string"
        ? body.redirect
        : "";

    const destination =
      requestedRoute &&
      canAccessRoute(
        employee,
        requestedRoute
      )
        ? requestedRoute
        : getDefaultRoute(employee);

    const response =
      NextResponse.json({
        employee: {
          id: employee.id,
          employeeCode:
            employee.employeeCode,
          name: employee.name,
          role: employee.role,
          kitchenId:
            employee.kitchenId,
        },
        redirectTo: destination,
      });

    response.cookies.set(
      "employee_code",
      employee.employeeCode,
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure:
          process.env.NODE_ENV ===
          "production",
      }
    );

    return response;
  } catch (error) {
    console.error(
      "POST /api/login failed:",
      error
    );

    return NextResponse.json(
      {
        error: "Unable to process login",
      },
      { status: 500 }
    );
  }
}
