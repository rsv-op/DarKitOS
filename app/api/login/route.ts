import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  findEmployeeByCode,
  isDemoSandboxEnabled,
  isDeveloperCode,
  isSafeRedirectPath,
  roleFromEmployeeCode,
  sanitizeEmployee,
  signToken,
  type AuthRole,
} from "@/lib/auth";
import { getRolePermissions } from "@/lib/domain/permission-service";
import {
  getEmployees,
  recordActivity,
} from "@/lib/store";

function getDefaultRoute(role: AuthRole): string {
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

function isHttpsRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0].trim().toLowerCase() === "https";
  }
  return request.nextUrl.protocol === "https:";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid login payload" },
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
        { error: "Employee code or station PIN is required" },
        { status: 400 },
      );
    }

    const employees = getEmployees();
    const role = roleFromEmployeeCode(rawCode, employees);
    const employee = findEmployeeByCode(rawCode, employees);

    if (!role || !employee) {
      return NextResponse.json(
        { error: "Invalid or inactive employee code / PIN" },
        { status: 401 },
      );
    }

    const developer = isDeveloperCode(rawCode);

    const requestedRedirect =
      typeof body.redirect === "string" &&
      isSafeRedirectPath(body.redirect)
        ? body.redirect
        : "";

    const destination = requestedRedirect || getDefaultRoute(role);

    const jwt = await signToken({
      userId: employee.id,
      employeeCode: employee.employeeCode,
      name: employee.name,
      role: employee.role,
      authRole: role,
      kitchenId: employee.kitchenId,
      developer,
    });

    const permissions = getRolePermissions(employee.role);
    const safeEmployee = sanitizeEmployee(employee);

    recordActivity({
      type: "AUTH_LOGIN",
      category: "AUTH",
      title: `${safeEmployee.name} (${safeEmployee.role}) Signed In`,
      details: `Authenticated via terminal code ${safeEmployee.employeeCode}${safeEmployee.kitchenId ? ` at ${safeEmployee.kitchenId}` : " (Global Scope)"}.`,
      actor: `${safeEmployee.employeeCode} (${safeEmployee.name})`,
      kitchenId: safeEmployee.kitchenId,
      severity: "info",
    });

    const response = NextResponse.json({
      employee: safeEmployee,
      role,
      permissions,
      developer,
      demoSandboxEnabled: isDemoSandboxEnabled(),
      redirectTo: destination,
    });

    const secureCookie = isHttpsRequest(request);

    response.cookies.set("dark_cloud_session", jwt, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: secureCookie,
      maxAge: 60 * 60 * 12,
    });

    // Clear explicit logout marker and any legacy unsigned employee_code cookie
    response.cookies.set("dark_cloud_logged_out", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: secureCookie,
      maxAge: 0,
      expires: new Date(0),
    });
    response.cookies.set("employee_code", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: secureCookie,
      maxAge: 0,
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    console.error("POST /api/login failed:", error);

    return NextResponse.json(
      { error: "Unable to process login" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const secureCookie = isHttpsRequest(request);
  const response = NextResponse.json({
    success: true,
  });

  response.cookies.set("dark_cloud_session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: secureCookie,
    maxAge: 0,
    expires: new Date(0),
  });
  response.cookies.set("employee_code", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: secureCookie,
    maxAge: 0,
    expires: new Date(0),
  });
  // Explicitly record logout so Demo Sandbox Mode does not immediately re-authenticate as Owner
  response.cookies.set("dark_cloud_logged_out", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: secureCookie,
    maxAge: 60 * 60 * 24,
  });

  return response;
}
