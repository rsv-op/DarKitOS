import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { type Employee } from "@/lib/db";
import { getEmployees } from "@/lib/store";
import {
  findEmployeeByCode,
  getSession,
  isDemoSandboxEnabled,
  sanitizeEmployee,
  type PublicEmployee,
} from "@/lib/auth";

export async function getEmployeeByCode(
  employeeCode: string,
): Promise<Employee | null> {
  const employees = await getEmployees();
  return findEmployeeByCode(employeeCode, employees);
}

export async function getAuthenticatedEmployee(
  request?: NextRequest,
): Promise<PublicEmployee | null> {
  // 1. Respect explicit sign-out marker FIRST (for both Route Handlers and Server Components)
  const cookieStore = request ? request.cookies : cookies();
  if (cookieStore.get("dark_cloud_logged_out")?.value === "1") {
    return null;
  }

  // 2. Verify signed HS256 JWT session cookie
  const session = await getSession(request);
  if (session) {
    const employees = await getEmployees();

    if (session.developer && isDemoSandboxEnabled()) {
      return {
        id: session.userId || "EMP-DEV-01",
        employeeCode: session.employeeCode || "DEVELOPER",
        name: session.name || "DarKitOS Demo Architect",
        role: "OWNER",
        kitchenId: session.kitchenId || "K1",
        active: true,
      };
    }

    const activeMatch = employees.find(
      (e) =>
        e.active &&
        (e.id === session.userId ||
          (session.employeeCode &&
            e.employeeCode.toLowerCase() ===
              session.employeeCode.toLowerCase())),
    );
    if (activeMatch) {
      return sanitizeEmployee(activeMatch);
    }

    // Employee was deactivated or removed since JWT was issued
    return null;
  }

  // 3. In non-demo production mode, require explicit authentication
  if (!isDemoSandboxEnabled()) {
    return null;
  }

  // 4. Instant demo sandbox default to OWNER-01 for seamless owner walkthroughs
  const defaultOwner = await getEmployeeByCode("OWNER-01");
  return defaultOwner ? sanitizeEmployee(defaultOwner) : null;
}
