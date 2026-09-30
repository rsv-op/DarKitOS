import {
  PERMISSIONS_DB,
  ROLE_PERMISSIONS_DB,
  type Employee,
  type PermissionCode,
} from "@/lib/db";

export function hasPermission(
  employee: Employee,
  permissionCode: PermissionCode
): boolean {
  const permission = PERMISSIONS_DB.find(
    (item) => item.code === permissionCode
  );

  if (!permission) {
    return false;
  }

  return ROLE_PERMISSIONS_DB.some(
    (rolePermission) =>
      rolePermission.role === employee.role &&
      rolePermission.permissionId === permission.id
  );
}
