import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  findEmployeeByCode,
  isDeveloperCode,
  roleFromEmployeeCode,
  tokenForRole,
  type AuthRole,
} from "@/lib/auth";

function getDefaultRoute(
  role: AuthRole,
): string {
  switch (role) {
    case "developer":
      return "/dev";

    case "owner":
      return "/owner";

    case "cook":
      return "/cook";

    case "dispatch":
      return "/dispatch";

    default:
      return "/login";
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const body = await request.json();

    if (
      !body ||
      typeof body !== "object"
    ) {
      return NextResponse.json(
        {
          error: "Invalid login payload",
        },
        { status: 400 },
      );
    }

    const employeeCode =
      typeof body.employeeCode === "string"
        ? body.employeeCode.trim()
        : "";

    if (!employeeCode) {
      return NextResponse.json(
        {
          error:
            "Employee code is required",
        },
        { status: 400 },
      );
    }

    const role =
      roleFromEmployeeCode(employeeCode);

    if (!role) {
      return NextResponse.json(
        {
          error: "Invalid employee code",
        },
        { status: 401 },
      );
    }

    const developer =
      isDeveloperCode(employeeCode);

    const employee =
      findEmployeeByCode(employeeCode);

    const destination =
      getDefaultRoute(role);

    const response =
      NextResponse.json({
        employee: employee
          ? {
              id: employee.id,
              employeeCode:
                employee.employeeCode,
              name: employee.name,
              role: employee.role,
              kitchenId:
                employee.kitchenId,
            }
          : {
              id: "DEV-ACCESS",
              employeeCode: "DEVELOPER",
              name: "Development Access",
              role: "DEVELOPER",
            },

        role,
        developer,
        redirectTo: destination,
      });

    response.cookies.set(
      "employee_code",
      employeeCode,
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure:
          process.env.NODE_ENV ===
          "production",
      },
    );

    response.cookies.set(
      "dark_cloud_session",
      tokenForRole(role),
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure:
          process.env.NODE_ENV ===
          "production",
      },
    );

    return response;
  } catch (error) {
    console.error(
      "POST /api/login failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to process login",
      },
      { status: 500 },
    );
  }
}
