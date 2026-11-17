import type { NextRequest } from "next/server";
import { type Employee } from "@/lib/db";
import { getEmployees } from "@/lib/store";
import {
  findEmployeeByCode,
  getSession,
} from "@/lib/auth";

export function getEmployeeByCode(
  employeeCode: string,
): Employee | null {
  return findEmployeeByCode(employeeCode, getEmployees());
}

export function getEmployeeFromCookie(
  cookieValue?: string,
): Employee | null {
  if (!cookieValue) {
    return null;
  }

  return getEmployeeByCode(cookieValue);
}

export async function getAuthenticatedEmployee(
  request?: NextRequest,
): Promise<Employee | null> {
  // 1. Check explicit header (used in iframe preview environments where 3rd-party cookies may be blocked)
  const headerCode = request?.headers.get(
    "x-employee-code",
  );
  if (headerCode) {
    const byHeader = getEmployeeByCode(headerCode);
    if (byHeader) return byHeader;
  }

  // 2. Check employee_code cookie
  const empCode = request
    ? request.cookies.get("employee_code")?.value
    : undefined;

  if (empCode) {
    const byCode = getEmployeeByCode(empCode);
    if (byCode) return byCode;
  }

  // 3. Check signed JWT session cookie
  const session = await getSession(request);
  if (session) {
    if (session.employeeCode) {
      const byCode = getEmployeeByCode(
        session.employeeCode,
      );
      if (byCode) return byCode;
    }

    const employees = getEmployees();
    const byId = employees.find(
      (e) => e.active && e.id === session.userId,
    );
    if (byId) return byId;

    return {
      id: session.userId,
      employeeCode:
        session.employeeCode || session.role,
      name: session.name || session.role,
      role: session.role,
      kitchenId: session.kitchenId || "K1",
      active: true,
    };
  }

  // 4. Default to canonical OWNER-01 session for seamless preview access unless explicitly logged out
  const loggedOut = request?.cookies.get(
    "dark_cloud_logged_out",
  )?.value;
  if (loggedOut === "1") {
    return null;
  }

  return getEmployeeByCode("OWNER-01");
}
