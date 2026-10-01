import {
  EMPLOYEES_DB,
  type Employee,
  type EmployeeRole,
} from "@/lib/db";

export type AuthRole =
  | "cook"
  | "dispatch"
  | "owner"
  | "developer";

const DEVELOPMENT_CODE = "9999";

const ROLE_TOKENS: Record<AuthRole, string> = {
  cook: "cook_token",
  dispatch: "dispatch_token",
  owner: "owner_token",
  developer: "dev_token",
};

export function findEmployeeByCode(
  employeeCode?: string,
): Employee | null {
  if (!employeeCode) {
    return null;
  }

  const normalized = employeeCode
    .trim()
    .toLowerCase();

  return (
    EMPLOYEES_DB.find(
      (employee) =>
        employee.active &&
        employee.employeeCode.toLowerCase() ===
          normalized,
    ) ?? null
  );
}

export function isDeveloperCode(
  employeeCode?: string,
): boolean {
  return employeeCode?.trim() === DEVELOPMENT_CODE;
}

export function roleFromEmployeeCode(
  employeeCode?: string,
): AuthRole | null {
  if (!employeeCode) {
    return null;
  }

  if (isDeveloperCode(employeeCode)) {
    return "developer";
  }

  const employee =
    findEmployeeByCode(employeeCode);

  if (!employee) {
    return null;
  }

  return roleFromEmployeeRole(employee.role);
}

export function roleFromEmployeeRole(
  role: EmployeeRole,
): AuthRole {
  switch (role) {
    case "OWNER":
      return "owner";

    case "DISPATCH":
      return "dispatch";

    case "MANAGER":
    case "LINE_COOK":
      return "cook";

    default:
      return "cook";
  }
}

export function tokenForRole(
  role: AuthRole,
): string {
  return ROLE_TOKENS[role];
}

export function roleFromToken(
  token?: string,
): AuthRole | null {
  if (!token) {
    return null;
  }

  const role = (
    Object.keys(ROLE_TOKENS) as AuthRole[]
  ).find(
    (candidate) =>
      ROLE_TOKENS[candidate] === token,
  );

  return role ?? null;
}

export function canAccessRole(
  role: AuthRole | null,
  allowed: readonly AuthRole[],
): boolean {
  if (!role) {
    return false;
  }

  if (role === "developer") {
    return true;
  }

  return allowed.includes(role);
}
