import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function WorkspacePage() {
  const session = await getSession();

  // Keep the role-specific shortcuts that used to run on the public homepage.
  if (session?.role === "LINE_COOK") redirect("/kds");
  if (session?.role === "DISPATCH") redirect("/dispatch");
  redirect("/dashboard");
}
