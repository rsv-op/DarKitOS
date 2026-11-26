import { redirect } from "next/navigation";
import { isDemoSandboxEnabled, isSafeRedirectPath } from "@/lib/auth";
import { getAuthenticatedEmployee } from "@/lib/domain/auth-service";
import { isSupabaseServerConfigured } from "@/lib/supabase-server";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { redirect?: string; error?: string };
}) {
  const employee = await getAuthenticatedEmployee();
  const requestedRedirect =
    typeof searchParams?.redirect === "string" &&
    isSafeRedirectPath(searchParams.redirect)
      ? searchParams.redirect
      : "";

  if (employee) {
    redirect(requestedRedirect || "/dashboard");
  }

  return (
    <LoginForm
      redirect={requestedRedirect}
      demoSandboxEnabled={isDemoSandboxEnabled()}
      supabaseConfigured={isSupabaseServerConfigured()}
      initialErrorCode={
        typeof searchParams?.error === "string" ? searchParams.error : ""
      }
    />
  );
}
