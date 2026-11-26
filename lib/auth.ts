import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  DEFAULT_ORGANIZATION_ID,
  EMPLOYEES_DB,
  type Employee,
  type EmployeeRole,
} from "@/lib/db";

const FALLBACK_DEV_SECRET =
  "dark-cloud-os-fallback-secret-key-2026";

function getJwtKey(): Uint8Array {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) {
    return new TextEncoder().encode(configured);
  }
  if (
    process.env.NODE_ENV === "production" &&
    !isDemoSandboxEnabled()
  ) {
    throw new Error(
      "JWT_SECRET environment variable must be configured in production.",
    );
  }
  return new TextEncoder().encode(FALLBACK_DEV_SECRET);
}

export function isDemoSandboxEnabled(): boolean {
  if (process.env.DEMO_SANDBOX_MODE === "false") {
    return false;
  }
  if (process.env.DEMO_SANDBOX_MODE === "true") {
    return true;
  }
  return process.env.NODE_ENV !== "production";
}

export function isStrictProductionMode(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.DEMO_SANDBOX_MODE !== "true"
  );
}

export type Role = EmployeeRole;

export type AuthRole =
  | "owner"
  | "manager"
  | "cook"
  | "dispatch"
  | "developer";

export type AuthProvider = "supabase" | "demo_jwt";

export interface PublicEmployee extends Omit<Employee, "pin"> {
  organizationId: string;
  employeeId: string;
  authProvider?: AuthProvider;
}

export type AuthenticatedEmployee = PublicEmployee;

export interface SessionPayload {
  userId: string;
  organizationId?: string;
  employeeCode?: string;
  name?: string;
  role: Role;
  authRole?: AuthRole;
  kitchenId?: string;
  authProvider?: AuthProvider;
  developer?: boolean;
  iat?: number;
  exp?: number;
}

// Demo-only shift PINs kept strictly server-side (never bundled into client code or API responses)
const DEMO_PIN_TO_CODE: Record<string, string> = {
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

export function sanitizeEmployee(
  employee: Employee,
  authProvider?: AuthProvider,
): PublicEmployee {
  return {
    id: employee.id,
    employeeId: employee.id,
    organizationId: employee.organizationId ?? DEFAULT_ORGANIZATION_ID,
    employeeCode: employee.employeeCode,
    name: employee.name,
    role: employee.role,
    kitchenId: employee.kitchenId,
    email: employee.email,
    phone: employee.phone,
    authUserId: employee.authUserId,
    active: employee.active,
    ...(authProvider ? { authProvider } : {}),
  };
}

export function isSafeRedirectPath(
  value: unknown,
): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return false;
  if (trimmed.startsWith("//")) return false;
  if (trimmed.includes("\\")) return false;
  if (/[\r\n\0]/.test(trimmed)) return false;
  if (trimmed === "/login") return false;
  return true;
}

export function isDeveloperCode(code: string): boolean {
  return DEVELOPER_CODES.has(code.trim().toUpperCase());
}

export function findEmployeeByCode(
  codeOrPin: string,
  employeeList: Employee[] = EMPLOYEES_DB,
): Employee | null {
  const normalized = codeOrPin.trim();
  if (!normalized) return null;

  const mappedCode =
    isDemoSandboxEnabled() && DEMO_PIN_TO_CODE[normalized]
      ? DEMO_PIN_TO_CODE[normalized]
      : normalized;

  if (isDemoSandboxEnabled() && isDeveloperCode(mappedCode)) {
    return {
      id: "EMP-DEV-01",
      organizationId: DEFAULT_ORGANIZATION_ID,
      employeeCode: "DEVELOPER",
      name: "DarKitOS Demo Architect",
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
          (emp.pin && emp.pin === normalized)),
    ) ?? null
  );
}

export function roleFromEmployeeCode(
  codeOrPin: string,
  employeeList: Employee[] = EMPLOYEES_DB,
): AuthRole | null {
  const normalized = codeOrPin.trim();
  if (!normalized) return null;

  if (isDemoSandboxEnabled() && isDeveloperCode(normalized)) {
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

export async function signToken(
  payload: SessionPayload,
): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getJwtKey());
}

export async function verifyToken(
  token: string,
): Promise<SessionPayload | null> {
  if (!token || token.startsWith("legacy_role_token:")) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(
      token,
      getJwtKey(),
      { algorithms: ["HS256"] },
    );
    if (
      typeof payload.userId !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }
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

  if (!sessionToken) {
    return null;
  }

  return await verifyToken(sessionToken);
}
