import { NextRequest, NextResponse } from "next/server";
import { isDemoSandboxEnabled, sanitizeEmployee } from "@/lib/auth";
import { resolveAuthContext } from "@/lib/domain/auth-service";
import {
  canAccessOrganization,
  getRolePermissions,
} from "@/lib/domain/permission-service";
import { getEmployees, getOrganizations, getSettings } from "@/lib/store";
import { isSupabaseServerConfigured } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const auth = await resolveAuthContext(request);
  const demoSandboxEnabled = isDemoSandboxEnabled();
  const supabaseConfigured = isSupabaseServerConfigured();
  const [settings, allEmployees, organizations] = await Promise.all([
    getSettings(),
    getEmployees(),
    getOrganizations(),
  ]);

  if (!auth.ok) {
    const safeActiveEmployees = demoSandboxEnabled
      ? allEmployees.filter((e) => e.active).map((e) => sanitizeEmployee(e))
      : [];

    return NextResponse.json(
      {
        authenticated: false,
        employee: null,
        organization: null,
        permissions: [],
        employees: safeActiveEmployees,
        settings,
        demoSandboxEnabled,
        supabaseConfigured,
        authReason: auth.reason,
        error: auth.status === 403 ? auth.error : undefined,
      },
      { status: auth.status === 403 ? 403 : 200 },
    );
  }

  const employee = auth.employee;
  const orgEmployees = allEmployees
    .filter((e) => e.active && canAccessOrganization(employee, e.organizationId))
    .map((e) => sanitizeEmployee(e));

  const organization =
    organizations.find((o) => o.id === employee.organizationId) ?? null;

  return NextResponse.json({
    authenticated: true,
    employee,
    organization,
    permissions: getRolePermissions(employee.role),
    employees: demoSandboxEnabled ? orgEmployees : [employee],
    settings,
    demoSandboxEnabled,
    supabaseConfigured,
  });
}
