import { NextRequest, NextResponse } from "next/server";
import { isSafeRedirectPath } from "@/lib/auth";
import { findOrLinkEmployeeByAuthIdentity } from "@/lib/store";
import {
  createSupabaseRouteHandlerClient,
  isSupabaseServerConfigured,
} from "@/lib/supabase-server";

function defaultDestinationForRole(role: string): string {
  switch (role) {
    case "LINE_COOK":
      return "/kds";
    case "DISPATCH":
      return "/dispatch";
    default:
      return "/dashboard";
  }
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code")?.trim() || "";
  const nextParam = request.nextUrl.searchParams.get("next") || "";

  if (!isSupabaseServerConfigured()) {
    return NextResponse.redirect(
      new URL("/login?error=auth_provider_not_configured", origin),
    );
  }

  const routeClient = createSupabaseRouteHandlerClient(request);
  if (!routeClient) {
    return NextResponse.redirect(
      new URL("/login?error=auth_provider_not_configured", origin),
    );
  }

  const { supabase, applyCookies } = routeClient;

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", origin));
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_or_expired_link", origin),
    );
  }

  const matched = await findOrLinkEmployeeByAuthIdentity({
    authUserId: data.user.id,
    email: data.user.email,
    phone: data.user.phone,
  });

  if (!matched) {
    await supabase.auth.signOut();
    return applyCookies(
      NextResponse.redirect(new URL("/login?error=not_provisioned", origin)),
    );
  }

  if (!matched.active) {
    await supabase.auth.signOut();
    return applyCookies(
      NextResponse.redirect(new URL("/login?error=deactivated", origin)),
    );
  }

  const safeNext = isSafeRedirectPath(nextParam)
    ? nextParam
    : defaultDestinationForRole(matched.role);

  const response = NextResponse.redirect(new URL(safeNext, origin));
  response.cookies.set("dark_cloud_logged_out", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return applyCookies(response);
}
