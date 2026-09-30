import { EMPLOYEES_DB, type Employee } from "@/lib/db";

export function getEmployeeByCode(
  employeeCode: string
): Employee | null {
  const normalized = employeeCode.trim();

  if (!normalized) {
    return null;
  }

  return (
    EMPLOYEES_DB.find(
      (employee) =>
        employee.active &&
        employee.employeeCode.toLowerCase() ===
          normalized.toLowerCase()
    ) ?? null
  );
}

export function getEmployeeFromCookie(
  cookieValue?: string
): Employee | null {
  if (!cookieValue) {
    return null;
  }

  return getEmployeeByCode(cookieValue);
}
