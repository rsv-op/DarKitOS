import { NextRequest, NextResponse } from "next/server";

import { EMPLOYEES_DB } from "@/lib/db";

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    if (
      !body ||
      typeof body !== "object"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid login payload",
        },
        { status: 400 }
      );
    }

    const employeeCode =
      typeof body.employeeCode ===
      "string"
        ? body.employeeCode.trim()
        : "";

    if (!employeeCode) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Employee code is required",
        },
        { status: 400 }
      );
    }

    const employee =
      EMPLOYEES_DB.find(
        (item) =>
          item.active &&
          item.employeeCode ===
            employeeCode
      );

    if (!employee) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid employee code",
        },
        { status: 401 }
      );
    }

    const response =
      NextResponse.json({
        success: true,
        employee: {
          id: employee.id,
          employeeCode:
            employee.employeeCode,
          name: employee.name,
          role: employee.role,
          kitchenId:
            employee.kitchenId,
        },
        redirectTo: "/",
      });

    response.cookies.set(
      "employee_code",
      employee.employeeCode,
      {
        httpOnly: true,
        sameSite: "lax",
        secure:
          process.env.NODE_ENV ===
          "production",
        path: "/",
        maxAge:
          60 * 60 * 12,
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
        success: false,
        error:
          "Unable to process login",
      },
      { status: 500 }
    );
  }
}
