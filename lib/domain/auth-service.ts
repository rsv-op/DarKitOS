import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_ORGANIZATION_ID, type Employee } from "@/lib/db";
import {
  findOrLinkEmployeeByAuthIdentity,
  getEmployees,
} from "@/lib/store";
import {
  findEmployeeByCode,
  getSession,
  isDemoSandboxEnabled,
  sanitizeEmployee,
  type AuthenticatedEmployee,
  type PublicEmployee,
} from "@/lib/auth";
import {
  createSupabaseRouteHandlerClient,
  createSupabaseServerClient,
  isSupabaseServerConfigured,
} from "@/lib/supabase-server";

export type { AuthenticatedEmployee, PublicEmployee };

export type AuthFailureReason =
  | "UNAUTHENTICATED"
  | "DEACTIVATED"
  | "UNPROVISIONED"
  | "DEMO_DISABLED";

export type AuthResolutionResult =
  | {
      ok: true;
      employee: AuthenticatedEmployee;
      source: "supabase" | "demo_jwt" | "sandbox_default";
    }
  | {
      ok: false;
      status: 401 | 403;
      reason: AuthFailureReason;
      error: string;
    };

export async function getEmployeeByCode(
  employeeCode: string,
): Promise<Employee | null> {
  const employees = await getEmployees();
  return findEmployeeByCode(employeeCode, employees);
}

/**
 * Resolves the authenticated employee across Supabase Auth (SSR cookies) and
 * signed HS256 JWT cookies, enforcing real-time `active` checks against the
 * database on every request so deactivated staff immediately receive 403.
 */
export async function resolveAuthContext(
  request?: NextRequest,
): Promise<AuthResolutionResult> {
  // 1. Respect explicit sign-out marker FIRST (for both Route Handlers and Server Components)
  const cookieStore = request ? request.cookies : cookies();
  if (cookieStore.get("dark_cloud_logged_out")?.value === "1") {
    return {
      ok: false,
      status: 401,
      reason: "UNAUTHENTICATED",
      error: "Unauthorized — signed out.",
    };
  }

  // 2. Check Supabase Auth session when Supabase env vars are configured
  if (isSupabaseServerConfigured()) {
    try {
      const supabase = request
        ? createSupabaseRouteHandlerClient(request)?.supabase ?? null
        : createSupabaseServerClient();

      if (supabase) {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!error && user) {
          const matched = await findOrLinkEmployeeByAuthIdentity({
            authUserId: user.id,
            email: user.email,
            phone: user.phone,
          });

          if (!matched) {
            return {
              ok: false,
              status: 403,
              reason: "UNPROVISIONED",
              error: "User not provisioned for any kitchen organization",
            };
          }

          if (!matched.active) {
            return {
              ok: false,
              status: 403,
              reason: "DEACTIVATED",
              error:
                "Employee account is deactivated. Contact your organization owner.",
            };
          }

          return {
            ok: true,
            source: "supabase",
            employee: sanitizeEmployee(matched, "supabase"),
          };
        }
      }
    } catch {
      // Fall through cleanly if Supabase auth check encounters an environment error
    }
  }

  // 3. Verify signed HS256 JWT session cookie (if present)
  const hasSessionCookie = Boolean(
    cookieStore.get("dark_cloud_session")?.value,
  );
  const session = await getSession(request);

  if (hasSessionCookie && !session) {
    return {
      ok: false,
      status: 401,
      reason: "UNAUTHENTICATED",
      error: "Unauthorized — invalid or expired session token.",
    };
  }

  if (session) {
    if (session.authProvider === "demo_jwt" && !isDemoSandboxEnabled()) {
      return {
        ok: false,
        status: 403,
        reason: "DEMO_DISABLED",
        error: "Demo sandbox session is disabled in production.",
      };
    }

    if (session.developer && isDemoSandboxEnabled()) {
      return {
        ok: true,
        source: "demo_jwt",
        employee: {
          id: session.userId || "EMP-DEV-01",
          employeeId: session.userId || "EMP-DEV-01",
          organizationId: session.organizationId || DEFAULT_ORGANIZATION_ID,
          employeeCode: session.employeeCode || "DEVELOPER",
          name: session.name || "DarKitOS Demo Architect",
          role: "OWNER",
          kitchenId: session.kitchenId || "K1",
          active: true,
          authProvider: "demo_jwt",
        },
      };
    }

    const employees = await getEmployees();
    const matchedEmployee = employees.find(
      (e) =>
        e.id === session.userId ||
        (session.employeeCode &&
          e.employeeCode.toLowerCase() ===
            session.employeeCode.toLowerCase()),
    );

    if (!matchedEmployee) {
      return {
        ok: false,
        status: 401,
        reason: "UNAUTHENTICATED",
        error: "Unauthorized — employee record no longer exists.",
      };
    }

    // Immediate revocation check on every request (no waiting for JWT expiry)
    if (!matchedEmployee.active) {
      return {
        ok: false,
        status: 403,
        reason: "DEACTIVATED",
        error:
          "Employee account is deactivated. Access revoked immediately.",
      };
    }

    return {
      ok: true,
      source: "demo_jwt",
      employee: sanitizeEmployee(
        matchedEmployee,
        session.authProvider ?? "demo_jwt",
      ),
    };
  }

  // 4. In non-demo production mode (or DEMO_SANDBOX_MODE=false), fail closed with 401
  if (!isDemoSandboxEnabled()) {
    return {
      ok: false,
      status: 401,
      reason: "UNAUTHENTICATED",
      error: "Unauthorized",
    };
  }

  // 5. Instant demo sandbox default to OWNER-01 for seamless local/demo walkthroughs
  const defaultOwner = await getEmployeeByCode("OWNER-01");
  if (!defaultOwner || !defaultOwner.active) {
    return {
      ok: false,
      status: 401,
      reason: "UNAUTHENTICATED",
      error: "Unauthorized",
    };
  }

  return {
    ok: true,
    source: "sandbox_default",
    employee: sanitizeEmployee(defaultOwner, "demo_jwt"),
  };
}

/**
 * Convenience guard for API route handlers that returns the exact HTTP 401/403
 * NextResponse on failure (including immediate 403 on deactivated staff).
 */
export async function requireAuthenticatedEmployee(
  request: NextRequest,
): Promise<
  | { ok: true; employee: AuthenticatedEmployee }
  | { ok: false; response: NextResponse }
> {
  const resolution = await resolveAuthContext(request);
  if (!resolution.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: resolution.error, reason: resolution.reason },
        { status: resolution.status },
      ),
    };
  }
  return { ok: true, employee: resolution.employee };
}

export async function getAuthenticatedEmployee(
  request?: NextRequest,
): Promise<AuthenticatedEmployee | null> {
  const resolution = await resolveAuthContext(request);
  return resolution.ok ? resolution.employee : null;
}
