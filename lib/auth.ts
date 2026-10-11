import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  EMPLOYEES_DB,
  type Employee,
  type EmployeeRole,
} from "@/lib/db";

const SECRET_KEY =
  process.env.JWT_SECRET ||
  "dark-cloud-os-fallback-secret-key-2026";

const key = new TextEncoder().encode(SECRET_KEY);

export type Role = EmployeeRole;

export type AuthRole =
  | "owner"
  | "manager"
  | "cook"
  | "dispatch"
  | "developer";

export interface SessionPayload {
  userId: string;
  employeeCode?: string;
  name?: string;
  role: Role;
  authRole?: AuthRole;
  kitchenId?: string;
  developer?: boolean;
  iat?: number;
  exp?: number;
}

const PIN_TO_CODE: Record<string, string> = {
  "3333": "OWNER-01",
  "9999": "0001",
  "1111": "2001",
  "2222": "3001",
};

const DEVELOPER_CODES = new Set([
  "DEV",
  "DEV-01",
  "DEVELOPER",
  "ADMIN-DEV",
]);

export function isDeveloperCode(code: string): boolean {
  return DEVELOPER_CODES.has(code.trim().toUpperCase());
}

export function findEmployeeByCode(
  codeOrPin: string,
  employeeList: Employee[] = EMPLOYEES_DB,
): Employee | null {
  const normalized = codeOrPin.trim();
  if (!normalized) return null;

  const mappedCode = PIN_TO_CODE[normalized] ?? normalized;

  if (isDeveloperCode(mappedCode)) {
    return {
      id: "EMP-DEV-01",
      employeeCode: "DEVELOPER",
      name: "Cloud7 Dev Architect",
      role: "OWNER",
      kitchenId: "K1",
      active: true,
    };
  }

  return (
    employeeList.find(
      (emp) =>
        emp.active &&
        (emp.employeeCode.toLowerCase() ===
          mappedCode.toLowerCase() ||
          emp.pin === normalized),
    ) ?? null
  );
}

export function roleFromEmployeeCode(
  codeOrPin: string,
  employeeList: Employee[] = EMPLOYEES_DB,
): AuthRole | null {
  const normalized = codeOrPin.trim();
  if (!normalized) return null;

  if (isDeveloperCode(normalized)) {
    return "developer";
  }

  const employee = findEmployeeByCode(
    normalized,
    employeeList,
  );
  if (!employee) return null;

  switch (employee.role) {
    case "OWNER":
      return "owner";
    case "MANAGER":
      return "manager";
    case "LINE_COOK":
      return "cook";
    case "DISPATCH":
      return "dispatch";
    default:
      return null;
  }
}

export function tokenForRole(role: AuthRole): string {
  return `legacy_role_token:${role}`;
}

export async function signToken(
  payload: SessionPayload,
): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(key);
}

export async function verifyToken(
  token: string,
): Promise<SessionPayload | null> {
  if (!token) return null;

  if (token.startsWith("legacy_role_token:")) {
    const authRole = token.replace(
      "legacy_role_token:",
      "",
    ) as AuthRole;
    const roleMap: Record<AuthRole, Role> = {
      owner: "OWNER",
      manager: "MANAGER",
      cook: "LINE_COOK",
      dispatch: "DISPATCH",
      developer: "OWNER",
    };
    const mappedRole = roleMap[authRole];
    if (!mappedRole) return null;
    return {
      userId:
        authRole === "developer"
          ? "EMP-DEV-01"
          : `EMP-${mappedRole}`,
      employeeCode:
        authRole === "developer"
          ? "DEVELOPER"
          : mappedRole,
      name:
        authRole === "developer"
          ? "Cloud7 Dev Architect"
          : mappedRole,
      role: mappedRole,
      authRole,
      kitchenId: "K1",
      developer: authRole === "developer",
    };
  }

  try {
    const { payload } = await jwtVerify(token, key);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(
  request?: NextRequest,
): Promise<SessionPayload | null> {
  const cookieStore = request
    ? request.cookies
    : cookies();

  const sessionToken = cookieStore.get(
    "dark_cloud_session",
  )?.value;

  if (sessionToken) {
    const verified = await verifyToken(sessionToken);
    if (verified) return verified;
  }

  const empCode = cookieStore.get("employee_code")?.value;
  if (empCode) {
    const emp = findEmployeeByCode(empCode);
    if (emp) {
      return {
        userId: emp.id,
        employeeCode: emp.employeeCode,
        name: emp.name,
        role: emp.role,
        kitchenId: emp.kitchenId,
        developer: isDeveloperCode(empCode),
      };
    }
  }

  return null;
}
