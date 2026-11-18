import type { Metadata } from "next";
import WelcomeHeader from "@/components/WelcomeHeader";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in | DarKitOS" };

export default function LoginPage({ searchParams }: { searchParams: { redirect?: string | string[] } }) {
  const redirectTo = typeof searchParams.redirect === "string" ? searchParams.redirect : undefined;

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100">
      <WelcomeHeader />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Cloud kitchen workspace</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-5xl">Sign in to DarKitOS</h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-slate-300">Use your employee code or shift PIN. Just looking around? Choose a demo role to try it with sample data.</p>
        <LoginForm redirectTo={redirectTo} />
      </main>
    </div>
  );
}
