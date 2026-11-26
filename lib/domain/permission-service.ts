import {
  DEFAULT_ORGANIZATION_ID,
  PERMISSIONS_DB,
  ROLE_PERMISSIONS_DB,
  type Employee,
  type EmployeeRole,
  type KitchenConfig,
  type Order,
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

export function resolveOrganizationId(
  record?: { organizationId?: string | null } | null,
): string {
  return record?.organizationId?.trim() || DEFAULT_ORGANIZATION_ID;
}

/**
 * Level 1 Isolation — Organization / Tenant boundary.
 * Cross-organization access is ALWAYS denied (even for OWNER roles).
 */
export function canAccessOrganization(
  employee: Pick<Employee, "organizationId">,
  targetOrganizationId?: string | null,
): boolean {
  const actorOrg = resolveOrganizationId(employee);
  const targetOrg = targetOrganizationId?.trim() || DEFAULT_ORGANIZATION_ID;
  return actorOrg === targetOrg;
}

/**
 * Returns true if the employee can view/act across all physical kitchens
 * WITHIN their own organization.
 */
export function hasGlobalScope(employee: Pick<Employee, "role" | "kitchenId">): boolean {
  return employee.role === "OWNER" || !employee.kitchenId;
}

/**
 * Returns the set of kitchen IDs that belong to the given organization.
 */
export function getOrganizationKitchenIds(
  organizationId: string,
  kitchens: KitchenConfig[],
): Set<string> {
  const targetOrg = organizationId.trim() || DEFAULT_ORGANIZATION_ID;
  return new Set(
    kitchens
      .filter((k) => resolveOrganizationId(k) === targetOrg)
      .map((k) => k.id),
  );
}

/**
 * Two-Level Isolation — returns the exact set of kitchen IDs an authenticated
 * employee is allowed to access (strictly intersected with their organization).
 */
export function getAccessibleKitchenIds(
  employee: Pick<Employee, "organizationId" | "role" | "kitchenId">,
  kitchens: KitchenConfig[],
): Set<string> {
  const orgKitchenIds = getOrganizationKitchenIds(
    resolveOrganizationId(employee),
    kitchens,
  );

  if (hasGlobalScope(employee)) {
    return orgKitchenIds;
  }

  const allowed = new Set<string>();
  if (employee.kitchenId && orgKitchenIds.has(employee.kitchenId)) {
    allowed.add(employee.kitchenId);
  }
  return allowed;
}

/**
 * Returns true if the employee is authorized to view or act on a specific kitchen.
 * When `kitchens` is provided, enforces BOTH Level 1 (organization) and Level 2 (kitchen)
 * isolation so an OWNER of ORG-001 can never access a kitchen owned by ORG-002.
 */
export function canAccessKitchen(
  employee: Pick<Employee, "organizationId" | "role" | "kitchenId">,
  kitchenId: string | undefined,
  kitchens?: KitchenConfig[],
): boolean {
  if (!kitchenId || kitchenId === "GLOBAL" || kitchenId === "ALL") {
    return hasGlobalScope(employee);
  }

  if (kitchens) {
    const kitchen = kitchens.find((k) => k.id === kitchenId);
    if (!kitchen) {
      return false;
    }
    if (!canAccessOrganization(employee, kitchen.organizationId)) {
      return false;
    }
  }

  if (hasGlobalScope(employee)) {
    return true;
  }
  return employee.kitchenId === kitchenId;
}

/**
 * Two-Level Order Isolation check:
 * 1. Order's organizationId must match employee's organizationId.
 * 2. Order's kitchenId must be accessible to employee within that organization.
 */
export function canAccessOrder(
  employee: Pick<Employee, "organizationId" | "role" | "kitchenId">,
  order: Pick<Order, "organizationId" | "kitchenId">,
  kitchens?: KitchenConfig[],
): boolean {
  if (!canAccessOrganization(employee, order.organizationId)) {
    return false;
  }
  return canAccessKitchen(employee, order.kitchenId, kitchens);
}

/**
 * Two-Level Staff Management check:
 * - Cross-org is ALWAYS forbidden.
 * - OWNER manages all staff within their own organization.
 * - MANAGER manages non-OWNER staff assigned to their own kitchen within their org.
 */
export function canManageEmployee(
  actor: Pick<Employee, "organizationId" | "role" | "kitchenId">,
  target: Pick<Employee, "organizationId" | "role" | "kitchenId">,
): boolean {
  if (!canAccessOrganization(actor, target.organizationId)) {
    return false;
  }
  if (actor.role === "OWNER") {
    return true;
  }
  if (actor.role === "MANAGER") {
    if (target.role === "OWNER") {
      return false;
    }
    return Boolean(actor.kitchenId && target.kitchenId === actor.kitchenId);
  }
  return false;
}
