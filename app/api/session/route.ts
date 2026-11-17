import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedEmployee } from "@/lib/domain/auth-service";
import { getRolePermissions } from "@/lib/domain/permission-service";
import { getEmployees, getSettings } from "@/lib/store";

export async function GET(request: NextRequest) {
  const employee = await getAuthenticatedEmployee(request);
  const employees = getEmployees();
  const settings = getSettings();

  if (!employee) {
    return NextResponse.json({
      authenticated: false,
      employee: null,
      permissions: [],
      employees: employees.filter((e) => e.active),
      settings,
    });
  }

  return NextResponse.json({
    authenticated: true,
    employee,
    permissions: getRolePermissions(employee.role),
    employees: employees.filter((e) => e.active),
    settings,
  });
}
