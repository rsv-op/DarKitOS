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
