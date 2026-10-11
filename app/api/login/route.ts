import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  findEmployeeByCode,
  isDeveloperCode,
  roleFromEmployeeCode,
  signToken,
  type AuthRole,
} from "@/lib/auth";
import { getRolePermissions } from "@/lib/domain/permission-service";
import {
  getEmployees,
  recordActivity,
} from "@/lib/store";

function getDefaultRoute(
  role: AuthRole,
): string {
  switch (role) {
    case "developer":
      return "/order-injection";
    case "owner":
    case "manager":
      return "/dashboard";
    case "cook":
      return "/kds";
    case "dispatch":
      return "/dispatch";
    default:
      return "/dashboard";
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

    const rawCode =
      typeof body.employeeCode === "string"
        ? body.employeeCode.trim()
        : typeof body.pin === "string"
          ? body.pin.trim()
          : "";

    if (!rawCode) {
      return NextResponse.json(
        {
          error:
            "Employee code or station PIN is required",
        },
        { status: 400 },
      );
    }

    const employees = getEmployees();
    const role = roleFromEmployeeCode(
      rawCode,
      employees,
    );
    const employee = findEmployeeByCode(
      rawCode,
      employees,
    );

    if (!role || !employee) {
      return NextResponse.json(
        {
          error:
            "Invalid or inactive employee code / PIN",
        },
        { status: 401 },
      );
    }

    const developer =
      isDeveloperCode(rawCode);

    const requestedRedirect =
      typeof body.redirect === "string" &&
      body.redirect.startsWith("/") &&
      body.redirect !== "/login"
        ? body.redirect
        : "";

    const destination =
      requestedRedirect ||
      getDefaultRoute(role);

    const jwt = await signToken({
      userId: employee.id,
      employeeCode: employee.employeeCode,
      name: employee.name,
      role: employee.role,
      authRole: role,
      kitchenId: employee.kitchenId,
      developer,
    });

    const permissions =
      getRolePermissions(employee.role);

    recordActivity({
      type: "AUTH_LOGIN",
      category: "AUTH",
      title: `${employee.name} (${employee.role}) Signed In`,
      details: `Authenticated via terminal code ${employee.employeeCode}${employee.kitchenId ? ` at ${employee.kitchenId}` : " (Global Scope)"}.`,
      actor: `${employee.employeeCode} (${employee.name})`,
      kitchenId: employee.kitchenId,
      severity: "info",
    });

    const response = NextResponse.json({
      employee: {
        id: employee.id,
        employeeCode:
          employee.employeeCode,
        name: employee.name,
        role: employee.role,
        kitchenId: employee.kitchenId,
      },
      role,
      permissions,
      developer,
      redirectTo: destination,
    });

    const cookieOptions = {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure:
        process.env.NODE_ENV ===
        "production",
      maxAge: 60 * 60 * 12,
    };

    response.cookies.set(
      "employee_code",
      employee.employeeCode,
      cookieOptions,
    );

    response.cookies.set(
      "dark_cloud_session",
      jwt,
      cookieOptions,
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

export async function DELETE() {
  const response = NextResponse.json({
    success: true,
  });
  response.cookies.delete("employee_code");
  response.cookies.delete(
    "dark_cloud_session",
  );
  return response;
}
