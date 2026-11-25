import {
  PERMISSIONS_DB,
  ROLE_PERMISSIONS_DB,
  type Employee,
  type EmployeeRole,
  type PermissionCode,
} from "@/lib/db";

export function hasPermission(
  employee: Employee,
  permissionCode: PermissionCode,
): boolean {
  const permission = PERMISSIONS_DB.find(
    (item) => item.code === permissionCode,
  );

  if (!permission) {
    return false;
  }

  return ROLE_PERMISSIONS_DB.some(
    (rolePermission) =>
      rolePermission.role === employee.role &&
      rolePermission.permissionId === permission.id,
  );
}

export function getRolePermissions(
  role: EmployeeRole,
): PermissionCode[] {
  const allowedIds = new Set(
    ROLE_PERMISSIONS_DB.filter((rp) => rp.role === role).map(
      (rp) => rp.permissionId,
    ),
  );
  return PERMISSIONS_DB.filter((p) =>
    allowedIds.has(p.id),
  ).map((p) => p.code);
}

/**
 * Returns true if the employee can view/act across all physical kitchens.
 * Only OWNER accounts (or accounts explicitly lacking a kitchen assignment while holding OWNER_VIEW)
 * have multi-kitchen global visibility.
 */
export function hasGlobalScope(employee: Employee): boolean {
  return employee.role === "OWNER" || !employee.kitchenId;
}

/**
 * Returns true if the employee is authorized to view or act on a specific kitchen.
 */
export function canAccessKitchen(
  employee: Employee,
  kitchenId: string | undefined,
): boolean {
  if (!kitchenId || kitchenId === "GLOBAL") {
    return hasGlobalScope(employee);
  }
  if (hasGlobalScope(employee)) {
    return true;
  }
  return employee.kitchenId === kitchenId;
}
