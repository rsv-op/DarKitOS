import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function OperationalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) redirect("/login");

  return (
    <div className="h-screen w-screen bg-[#0B111E] text-slate-100 overflow-hidden font-sans flex flex-col">
      {/* Universal Operational Header */}
      <header className="h-14 bg-[#1E293B] border-b border-slate-800 flex justify-between items-center px-6 shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-bold tracking-tight text-lg">
            DARKit
            <span className="text-emerald-500">
              OS
            </span>
          </span>
          <span className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400 font-mono">
            NODE:{" "}
            {session.kitchenId ||
              "GLOBAL"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs text-slate-400 uppercase tracking-wider">
              Live Sync
            </span>
          </div>
        </div>
      </header>

      {/* Full-bleed workspace */}
      <main className="flex-1 overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
