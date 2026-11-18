import Link from "next/link";
import GuideIcon from "@/components/GuideIcon";

export default function WelcomeHeader({ home = false }: { home?: boolean }) {
  return (
    <header className="border-b border-white/[0.08]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-10 focus:rounded-lg focus:bg-cyan-200 focus:px-4 focus:py-2 focus:text-slate-950"
      >
        Skip to content
      </a>
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg text-lg font-bold tracking-tight text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
            <GuideIcon name="brand" />
          </span>
          <span>DarKit<span className="text-cyan-200">OS</span></span>
        </Link>
        <nav aria-label="Product navigation" className="flex items-center gap-5 text-sm font-medium sm:gap-7">
          {home && (
            <>
              <a href="#how-it-works" className="hidden rounded text-slate-300 hover:text-white focus-visible:outline focus-visible:outline-offset-4 focus-visible:outline-cyan-300 sm:inline">How it works</a>
              <a href="#demo-roles" className="hidden rounded text-slate-300 hover:text-white focus-visible:outline focus-visible:outline-offset-4 focus-visible:outline-cyan-300 sm:inline">Demo roles</a>
            </>
          )}
          <Link
            href={home ? "/login" : "/"}
            className="inline-flex min-h-10 items-center rounded-lg border border-slate-700 px-3.5 text-slate-200 transition hover:border-cyan-300/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
          >
            {home ? "Sign in" : "Product guide"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
