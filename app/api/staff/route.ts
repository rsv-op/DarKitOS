import { NextRequest, NextResponse } from "next/server";
import { sanitizeEmployee } from "@/lib/auth";
import type { Employee, EmployeeRole } from "@/lib/db";
import { requireAuthenticatedEmployee } from "@/lib/domain/auth-service";
import {
  canAccessKitchen,
  canAccessOrganization,
  canManageEmployee,
  hasGlobalScope,
  hasPermission,
} from "@/lib/domain/permission-service";
import {
  getEmployees,
  getKitchens,
  upsertCanonicalEmployee,
} from "@/lib/store";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const ALLOWED_ROLES = new Set<EmployeeRole>([
  "OWNER",
  "MANAGER",
  "LINE_COOK",
  "DISPATCH",
]);

function scopeVisibleEmployees(
  actor: Employee,
  employees: Employee[],
) {
  return employees
    .filter((e) => {
      if (!canAccessOrganization(actor, e.organizationId)) {
        return false;
      }
      if (hasGlobalScope(actor)) {
        return true;
      }
      return e.kitchenId === actor.kitchenId;
    })
    .map((e) => sanitizeEmployee(e));
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedEmployee(request);
    if (!auth.ok) return auth.response;
    const actor = auth.employee;

    if (!hasPermission(actor, "STAFF_MANAGE")) {
      return NextResponse.json(
        { error: "Forbidden: Requires STAFF_MANAGE permission" },
        { status: 403 },
      );
    }

    const [employees, kitchens] = await Promise.all([
      getEmployees(),
      getKitchens(),
    ]);

    const visibleEmployees = scopeVisibleEmployees(actor, employees);
    const orgKitchens = kitchens.filter((k) =>
      canAccessOrganization(actor, k.organizationId),
    );

    return NextResponse.json({
      employees: visibleEmployees,
      kitchens: hasGlobalScope(actor)
        ? orgKitchens
        : orgKitchens.filter((k) => k.id === actor.kitchenId),
      organizationId: actor.organizationId,
    });
  } catch (error) {
    console.error("GET /api/staff failed:", error);
    return NextResponse.json(
      { error: "Unable to load staff directory" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedEmployee(request);
    if (!auth.ok) return auth.response;
    const actor = auth.employee;

    if (!hasPermission(actor, "STAFF_MANAGE")) {
      return NextResponse.json(
        { error: "Forbidden: Requires STAFF_MANAGE permission" },
        { status: 403 },
      );
    }

    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid staff payload" },
        { status: 400 },
      );
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const role = String(body.role || "LINE_COOK").trim() as EmployeeRole;
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const requestedOrgId =
      typeof body.organizationId === "string"
        ? body.organizationId.trim()
        : "";
    const rawCode =
      typeof body.employeeCode === "string" ? body.employeeCode.trim() : "";
    const requestedKitchenId =
      typeof body.kitchenId === "string" ? body.kitchenId.trim() : "";

    if (!name) {
      return NextResponse.json(
        { error: "Employee name is required" },
        { status: 400 },
      );
    }

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json(
        { error: `Invalid employee role: ${role}` },
        { status: 400 },
      );
    }

    if (requestedOrgId && !canAccessOrganization(actor, requestedOrgId)) {
      return NextResponse.json(
        {
          error: `Forbidden: Cannot provision staff inside organization ${requestedOrgId}`,
        },
        { status: 403 },
      );
    }

    if (!hasGlobalScope(actor) && role === "OWNER") {
      return NextResponse.json(
        { error: "Forbidden: Kitchen managers cannot provision OWNER accounts" },
        { status: 403 },
      );
    }

    const kitchens = await getKitchens();
    const orgKitchens = kitchens.filter((k) =>
      canAccessOrganization(actor, k.organizationId),
    );
    const targetKitchenId =
      role === "OWNER"
        ? undefined
        : requestedKitchenId || actor.kitchenId || orgKitchens[0]?.id;

    if (role !== "OWNER") {
      if (!targetKitchenId || !canAccessKitchen(actor, targetKitchenId, kitchens)) {
        return NextResponse.json(
          {
            error: `Forbidden: Cannot provision staff in kitchen ${targetKitchenId || "UNKNOWN"}`,
          },
          { status: 403 },
        );
      }
    }

    const employeeCode =
      rawCode ||
      `${role.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const actorLabel = `${actor.employeeCode} (${actor.name})`;
    const updatedList = await upsertCanonicalEmployee(
      {
        organizationId: actor.organizationId,
        employeeCode,
        name,
        role,
        kitchenId: targetKitchenId,
        email: email || undefined,
        phone: phone || undefined,
        active: typeof body.active === "boolean" ? body.active : true,
      },
      actorLabel,
    );

    const created = updatedList.find(
      (e) => e.employeeCode.toLowerCase() === employeeCode.toLowerCase(),
    );

    // Optional Supabase Admin invite when service role key is configured and email provided
    let inviteSent = false;
    if (body.sendInvite && email) {
      const adminClient = createSupabaseAdminClient();
      if (adminClient) {
        try {
          const { error: inviteErr } =
            await adminClient.auth.admin.inviteUserByEmail(email);
          inviteSent = !inviteErr;
        } catch {
          inviteSent = false;
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        employee: created ? sanitizeEmployee(created) : null,
        employees: scopeVisibleEmployees(actor, updatedList),
        inviteSent,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to provision staff";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedEmployee(request);
    if (!auth.ok) return auth.response;
    const actor = auth.employee;

    if (!hasPermission(actor, "STAFF_MANAGE")) {
      return NextResponse.json(
        { error: "Forbidden: Requires STAFF_MANAGE permission" },
        { status: 403 },
      );
    }

    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid staff update payload" },
        { status: 400 },
      );
    }

    const targetId = typeof body.id === "string" ? body.id.trim() : "";
    const targetCode =
      typeof body.employeeCode === "string" ? body.employeeCode.trim() : "";

    if (!targetId && !targetCode) {
      return NextResponse.json(
        { error: "Employee id or employeeCode is required" },
        { status: 400 },
      );
    }

    const [allEmployees, kitchens] = await Promise.all([
      getEmployees(),
      getKitchens(),
    ]);

    const target = allEmployees.find(
      (e) =>
        (targetId && e.id === targetId) ||
        (targetCode &&
          e.employeeCode.toLowerCase() === targetCode.toLowerCase()),
    );

    if (!target) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 },
      );
    }

    if (!canManageEmployee(actor, target)) {
      return NextResponse.json(
        {
          error: `Forbidden: Employee ${actor.employeeCode} cannot modify staff member ${target.employeeCode}`,
        },
        { status: 403 },
      );
    }

    if (target.id === actor.id && body.active === false) {
      return NextResponse.json(
        { error: "You cannot deactivate your own active session account." },
        { status: 400 },
      );
    }

    const nextRole =
      typeof body.role === "string"
        ? (body.role.trim() as EmployeeRole)
        : target.role;

    if (!ALLOWED_ROLES.has(nextRole)) {
      return NextResponse.json(
        { error: `Invalid employee role: ${nextRole}` },
        { status: 400 },
      );
    }

    if (!hasGlobalScope(actor) && nextRole === "OWNER") {
      return NextResponse.json(
        { error: "Forbidden: Kitchen managers cannot promote staff to OWNER" },
        { status: 403 },
      );
    }

    const nextKitchenId =
      nextRole === "OWNER"
        ? undefined
        : typeof body.kitchenId === "string" && body.kitchenId.trim()
          ? body.kitchenId.trim()
          : target.kitchenId;

    if (
      nextRole !== "OWNER" &&
      nextKitchenId &&
      !canAccessKitchen(actor, nextKitchenId, kitchens)
    ) {
      return NextResponse.json(
        {
          error: `Forbidden: Cannot assign staff to kitchen ${nextKitchenId}`,
        },
        { status: 403 },
      );
    }

    const actorLabel = `${actor.employeeCode} (${actor.name})`;
    const updatedList = await upsertCanonicalEmployee(
      {
        id: target.id,
        organizationId: target.organizationId ?? actor.organizationId,
        employeeCode: target.employeeCode,
        name:
          typeof body.name === "string" && body.name.trim()
            ? body.name.trim()
            : target.name,
        role: nextRole,
        kitchenId: nextKitchenId,
        email:
          typeof body.email === "string" ? body.email.trim() : target.email,
        phone:
          typeof body.phone === "string" ? body.phone.trim() : target.phone,
        active:
          typeof body.active === "boolean" ? body.active : target.active,
      },
      actorLabel,
    );

    const updated = updatedList.find((e) => e.id === target.id);

    return NextResponse.json({
      success: true,
      employee: updated ? sanitizeEmployee(updated) : null,
      employees: scopeVisibleEmployees(actor, updatedList),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update staff";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
