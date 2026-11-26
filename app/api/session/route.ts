import { NextRequest, NextResponse } from "next/server";
import {
  isDemoSandboxEnabled,
  sanitizeEmployee,
} from "@/lib/auth";
import { getAuthenticatedEmployee } from "@/lib/domain/auth-service";
import { getRolePermissions } from "@/lib/domain/permission-service";
import { getEmployees, getSettings } from "@/lib/store";

export async function GET(request: NextRequest) {
  const employee = await getAuthenticatedEmployee(request);
  const demoSandboxEnabled = isDemoSandboxEnabled();
  const [settings, allEmployees] = await Promise.all([
    getSettings(),
    getEmployees(),
  ]);
  const safeActiveEmployees = allEmployees
    .filter((e) => e.active)
    .map(sanitizeEmployee);

  if (!employee) {
    return NextResponse.json({
      authenticated: false,
      employee: null,
      permissions: [],
      // Only expose the demo role-switcher directory when Demo Sandbox Mode is explicitly enabled
      employees: demoSandboxEnabled ? safeActiveEmployees : [],
      settings,
      demoSandboxEnabled,
    });
  }

  return NextResponse.json({
    authenticated: true,
    employee: sanitizeEmployee(employee),
    permissions: getRolePermissions(employee.role),
    employees: demoSandboxEnabled
      ? safeActiveEmployees
      : [sanitizeEmployee(employee)],
    settings,
    demoSandboxEnabled,
  });
}
