import { NextRequest, NextResponse } from "next/server";
import {
  findEmployeeByCode,
  isDemoSandboxEnabled,
  isDeveloperCode,
  isSafeRedirectPath,
  roleFromEmployeeCode,
  sanitizeEmployee,
  signToken,
  type AuthRole,
} from "@/lib/auth";
import type { Employee } from "@/lib/db";
import { getRolePermissions } from "@/lib/domain/permission-service";
import {
  findOrLinkEmployeeByAuthIdentity,
  getEmployees,
  recordActivity,
} from "@/lib/store";
import {
  createSupabaseRouteHandlerClient,
  isSupabaseServerConfigured,
} from "@/lib/supabase-server";

function getDefaultRoute(role: AuthRole): string {
  switch (role) {
    case "developer":
      return "/order-injection";
    case "owner":
    case "manager":
      return "/dashboard";
    case "cook":
      return "/kds";
    case "dispatch":
      return "/dispatch";
    default:
      return "/dashboard";
  }
}

function authRoleFromEmployee(employee: Employee): AuthRole {
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
      return "cook";
  }
}

function isHttpsRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0].trim().toLowerCase() === "https";
  }
  return request.nextUrl.protocol === "https:";
}

function clearLogoutMarker(response: NextResponse, secureCookie: boolean) {
  response.cookies.set("dark_cloud_logged_out", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: secureCookie,
    maxAge: 0,
    expires: new Date(0),
  });
  response.cookies.set("employee_code", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: secureCookie,
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid login payload" },
        { status: 400 },
      );
    }

    const secureCookie = isHttpsRequest(request);
    const requestedRedirect =
      typeof body.redirect === "string" && isSafeRedirectPath(body.redirect)
        ? body.redirect
        : "";

    const mode = typeof body.mode === "string" ? body.mode.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const password =
      typeof body.password === "string" ? body.password : "";
    const otpToken =
      typeof body.token === "string" ? body.token.trim() : "";

    const isSupabaseFlow =
      mode === "password" ||
      mode === "otp_request" ||
      mode === "otp_verify" ||
      Boolean(email && password) ||
      Boolean(otpToken);

    // -------------------------------------------------------------------------
    // Path A: Supabase Auth (Email+Password or Email/Phone OTP)
    // -------------------------------------------------------------------------
    if (isSupabaseFlow) {
      if (!isSupabaseServerConfigured()) {
        return NextResponse.json(
          { error: "Auth provider not configured" },
          { status: 503 },
        );
      }

      const routeClient = createSupabaseRouteHandlerClient(request);
      if (!routeClient) {
        return NextResponse.json(
          { error: "Auth provider not configured" },
          { status: 503 },
        );
      }

      const { supabase, applyCookies } = routeClient;

      if (mode === "otp_request") {
        if (!email && !phone) {
          return NextResponse.json(
            { error: "Email or phone number is required to send an OTP." },
            { status: 400 },
          );
        }

        const origin = request.nextUrl.origin;
        const emailRedirectTo = requestedRedirect
          ? `${origin}/api/auth/callback?next=${encodeURIComponent(requestedRedirect)}`
          : `${origin}/api/auth/callback`;

        const otpResponse = email
          ? await supabase.auth.signInWithOtp({
              email,
              options: { emailRedirectTo },
            })
          : await supabase.auth.signInWithOtp({ phone });

        if (otpResponse.error) {
          return NextResponse.json(
            { error: otpResponse.error.message || "Failed to send OTP" },
            { status: 400 },
          );
        }

        const res = NextResponse.json({
          otpSent: true,
          channel: email ? "email" : "phone",
          message: email
            ? `One-time code & magic link sent to ${email}.`
            : `One-time SMS verification code sent to ${phone}.`,
        });
        return applyCookies(res);
      }

      let authUser: { id: string; email?: string; phone?: string } | null =
        null;

      if (mode === "otp_verify" || otpToken) {
        if (!otpToken || (!email && !phone)) {
          return NextResponse.json(
            {
              error:
                "Verification code and email or phone number are required.",
            },
            { status: 400 },
          );
        }

        const verifyRes = email
          ? await supabase.auth.verifyOtp({
              email,
              token: otpToken,
              type: "email",
            })
          : await supabase.auth.verifyOtp({
              phone,
              token: otpToken,
              type: "sms",
            });

        if (verifyRes.error || !verifyRes.data.user) {
          return NextResponse.json(
            {
              error:
                verifyRes.error?.message || "Invalid or expired OTP code.",
            },
            { status: 401 },
          );
        }

        authUser = {
          id: verifyRes.data.user.id,
          email: verifyRes.data.user.email,
          phone: verifyRes.data.user.phone,
        };
      } else {
        if (!email || !password) {
          return NextResponse.json(
            { error: "Email and password are required." },
            { status: 400 },
          );
        }

        const signInRes = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInRes.error || !signInRes.data.user) {
          return NextResponse.json(
            {
              error:
                signInRes.error?.message || "Invalid email or password.",
            },
            { status: 401 },
          );
        }

        authUser = {
          id: signInRes.data.user.id,
          email: signInRes.data.user.email,
          phone: signInRes.data.user.phone,
        };
      }

      // Link & verify employee provisioning inside DarKitOS
      const matchedEmployee = await findOrLinkEmployeeByAuthIdentity({
        authUserId: authUser.id,
        email: authUser.email,
        phone: authUser.phone,
      });

      if (!matchedEmployee) {
        await supabase.auth.signOut();
        const unprovisionedRes = NextResponse.json(
          { error: "User not provisioned for any kitchen organization" },
          { status: 403 },
        );
        return applyCookies(unprovisionedRes);
      }

      if (!matchedEmployee.active) {
        await supabase.auth.signOut();
        const deactivatedRes = NextResponse.json(
          {
            error:
              "Employee account is deactivated. Contact your organization owner.",
          },
          { status: 403 },
        );
        return applyCookies(deactivatedRes);
      }

      const authRole = authRoleFromEmployee(matchedEmployee);
      const destination = requestedRedirect || getDefaultRoute(authRole);
      const safeEmployee = sanitizeEmployee(matchedEmployee, "supabase");
      const permissions = getRolePermissions(matchedEmployee.role);

      await recordActivity({
        organizationId: safeEmployee.organizationId,
        type: "AUTH_LOGIN",
        category: "AUTH",
        title: `${safeEmployee.name} (${safeEmployee.role}) Signed In (Supabase Auth)`,
        details: `Authenticated via Supabase Auth (${authUser.email || authUser.phone || authUser.id})${safeEmployee.kitchenId ? ` at ${safeEmployee.kitchenId}` : " (Global Scope)"}.`,
        actor: `${safeEmployee.employeeCode} (${safeEmployee.name})`,
        kitchenId: safeEmployee.kitchenId,
        severity: "info",
      });

      const response = NextResponse.json({
        employee: safeEmployee,
        role: authRole,
        permissions,
        authProvider: "supabase",
        demoSandboxEnabled: isDemoSandboxEnabled(),
        redirectTo: destination,
      });

      clearLogoutMarker(response, secureCookie);
      return applyCookies(response);
    }

    // -------------------------------------------------------------------------
    // Path B: Demo Sandbox Employee Code / PIN (strictly disabled in production)
    // -------------------------------------------------------------------------
    const rawCode =
      typeof body.employeeCode === "string"
        ? body.employeeCode.trim()
        : typeof body.pin === "string"
          ? body.pin.trim()
          : "";

    if (!isDemoSandboxEnabled()) {
      if (rawCode) {
        return NextResponse.json(
          {
            error:
              "Demo quick-login and shift PINs are disabled in production. Use Email/Password or OTP sign-in.",
          },
          { status: 403 },
        );
      }
      if (!isSupabaseServerConfigured()) {
        return NextResponse.json(
          { error: "Auth provider not configured" },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { error: "Email and password or OTP credentials are required." },
        { status: 400 },
      );
    }

    if (!rawCode) {
      return NextResponse.json(
        { error: "Employee code, station PIN, or Email/Password is required" },
        { status: 400 },
      );
    }

    const employees = await getEmployees();
    const role = roleFromEmployeeCode(rawCode, employees);
    const employee = findEmployeeByCode(rawCode, employees);

    if (!role || !employee) {
      return NextResponse.json(
        { error: "Invalid or inactive employee code / PIN" },
        { status: 401 },
      );
    }

    const developer = isDeveloperCode(rawCode);
    const destination = requestedRedirect || getDefaultRoute(role);
    const safeEmployee = sanitizeEmployee(employee, "demo_jwt");

    const jwt = await signToken({
      userId: employee.id,
      organizationId: safeEmployee.organizationId,
      employeeCode: employee.employeeCode,
      name: employee.name,
      role: employee.role,
      authRole: role,
      kitchenId: employee.kitchenId,
      authProvider: "demo_jwt",
      developer,
    });

    const permissions = getRolePermissions(employee.role);

    await recordActivity({
      organizationId: safeEmployee.organizationId,
      type: "AUTH_LOGIN",
      category: "AUTH",
      title: `${safeEmployee.name} (${safeEmployee.role}) Signed In`,
      details: `Authenticated via terminal code ${safeEmployee.employeeCode}${safeEmployee.kitchenId ? ` at ${safeEmployee.kitchenId}` : " (Global Scope)"}.`,
      actor: `${safeEmployee.employeeCode} (${safeEmployee.name})`,
      kitchenId: safeEmployee.kitchenId,
      severity: "info",
    });

    const response = NextResponse.json({
      employee: safeEmployee,
      role,
      permissions,
      developer,
      authProvider: "demo_jwt",
      demoSandboxEnabled: isDemoSandboxEnabled(),
      redirectTo: destination,
    });

    response.cookies.set("dark_cloud_session", jwt, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: secureCookie,
      maxAge: 60 * 60 * 12,
    });

    clearLogoutMarker(response, secureCookie);

    return response;
  } catch (error) {
    console.error("POST /api/login failed:", error);

    return NextResponse.json(
      { error: "Unable to process login" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const secureCookie = isHttpsRequest(request);
  const response = NextResponse.json({
    success: true,
  });

  if (isSupabaseServerConfigured()) {
    try {
      const routeClient = createSupabaseRouteHandlerClient(request);
      if (routeClient) {
        await routeClient.supabase.auth.signOut();
        routeClient.applyCookies(response);
      }
    } catch {
      // Proceed with local cookie clearing even if Supabase signOut fails
    }
  }

  response.cookies.set("dark_cloud_session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: secureCookie,
    maxAge: 0,
    expires: new Date(0),
  });
  response.cookies.set("employee_code", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: secureCookie,
    maxAge: 0,
    expires: new Date(0),
  });
  // Explicitly record logout so Demo Sandbox Mode does not immediately re-authenticate as Owner
  response.cookies.set("dark_cloud_logged_out", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: secureCookie,
    maxAge: 60 * 60 * 24,
  });

  return response;
}
