import Link from "next/link";
import AppShell from "@/components/AppShell";
import OrderSimulationPanel from "@/components/OrderSimulationPanel";

export default function OrderInjectionPage() {
  return (
    <AppShell
      title="Sample Orders"
      subtitle="Try adding an order with sample data. It will appear in Live Orders and on the Kitchen Board."
      actions={
        <>
          <Link
            href="/live-orders"
            className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 font-mono text-xs font-bold text-slate-200 hover:border-sky-500/40 hover:text-sky-300"
          >
            View Live Orders →
          </Link>
          <Link
            href="/kds"
            className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 font-mono text-xs font-bold text-slate-200 hover:border-sky-500/40 hover:text-sky-300"
          >
            Open Kitchen Board →
          </Link>
        </>
      }
    >
      <OrderSimulationPanel />
    </AppShell>
  );
}
