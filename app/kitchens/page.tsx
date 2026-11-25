"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { formatCurrency, type SupportedCurrency } from "@/lib/currency";
import {
  KITCHENS_DB,
  type BrandKitchenConfig,
  type Employee,
  type KitchenConfig,
  type Order,
  type SystemSettings,
} from "@/lib/db";

export default function KitchensPage() {
  const [kitchens, setKitchens] = useState<
    KitchenConfig[]
  >(KITCHENS_DB);
  const [brandKitchens, setBrandKitchens] =
    useState<BrandKitchenConfig[]>([]);
  const [orders, setOrders] = useState<Order[]>(
    [],
  );
  const [employees, setEmployees] = useState<
    Employee[]
  >([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [currency, setCurrency] =
    useState<SupportedCurrency>("INR");

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/system", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ||
            "Unable to load physical kitchens.",
        );
      }
      if (Array.isArray(data.kitchens))
        setKitchens(data.kitchens);
      if (Array.isArray(data.brandKitchens))
        setBrandKitchens(data.brandKitchens);
      if (Array.isArray(data.orders))
        setOrders(data.orders);
      if (Array.isArray(data.employees))
        setEmployees(data.employees);
      if (data.settings?.currency)
        setCurrency(data.settings.currency);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Load failed.",
      );
    }
  }, []);

  useEffect(() => {
    void loadData();
    const onSettingsUpdated = (event: Event) => {
      const custom = event as CustomEvent<SystemSettings>;
      if (custom.detail?.currency) setCurrency(custom.detail.currency);
    };
    window.addEventListener("darkit:settings-updated", onSettingsUpdated);
    return () =>
      window.removeEventListener("darkit:settings-updated", onSettingsUpdated);
  }, [loadData]);

  async function toggleKitchen(
    kitchenId: string,
  ) {
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/system", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "TOGGLE_KITCHEN_ACTIVE",
          kitchenId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ||
            "Failed to toggle kitchen status.",
        );
      }
      setKitchens(data.kitchens);
      setNotice(
        `Updated operational status for facility ${kitchenId}.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Update failed.",
      );
    }
  }

  return (
    <AppShell
      title="Kitchens"
      subtitle="See which brands, staff, and orders belong to each kitchen location."
      actions={
        <Link
          href="/brands"
          className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 font-mono text-xs font-bold text-sky-300"
        >
          Manage BrandKitchen Matrix →
        </Link>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-300">
            ⚠ {error}
          </div>
        )}
        {notice && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 font-mono text-xs text-emerald-300">
            ✓ {notice}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {kitchens.map((kitchen) => {
            const activeBrands = brandKitchens
              .filter(
                (bk) =>
                  bk.kitchenId === kitchen.id &&
                  bk.active,
              )
              .map((bk) => bk.brandId);

            const kitchenOrders = orders.filter(
              (o) =>
                o.kitchenId === kitchen.id,
            );
            const activeLoad =
              kitchenOrders.filter(
                (o) =>
                  o.status === "PENDING" ||
                  o.status === "PREPARING" ||
                  o.status ===
                    "READY_FOR_PICKUP",
              ).length;
            const revenue = kitchenOrders
              .filter(
                (o) => o.status !== "CANCELLED",
              )
              .reduce(
                (s, o) =>
                  s + (o.totalAmount ?? 0),
                0,
              );
            const staff = employees.filter(
              (e) =>
                e.kitchenId === kitchen.id &&
                e.active,
            );

            return (
              <section
                key={kitchen.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/75 p-6 shadow-xl"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 font-mono text-xs font-black text-sky-300">
                        {kitchen.id} •{" "}
                        {kitchen.code}
                      </span>
                      <span className="font-mono text-xs text-slate-400">
                        {kitchen.timezone}
                      </span>
                    </div>
                    <h2 className="mt-2 text-xl font-black text-white">
                      {kitchen.name}
                    </h2>
                    <p className="text-xs text-slate-400">
                      Location:{" "}
                      {kitchen.location}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void toggleKitchen(
                        kitchen.id,
                      )
                    }
                    className={`rounded-xl border px-3.5 py-2 font-mono text-xs font-bold transition ${
                      kitchen.active
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                        : "border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25"
                    }`}
                  >
                    {kitchen.active
                      ? "● ONLINE (Active)"
                      : "○ MAINTENANCE (Paused)"}
                  </button>
                </div>

                {/* Facility KPIs */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <p className="font-mono text-[10px] uppercase text-slate-400">
                      Active KDS Load
                    </p>
                    <p className="mt-1 text-2xl font-black text-amber-300">
                      {activeLoad}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <p className="font-mono text-[10px] uppercase text-slate-400">
                      Total Orders
                    </p>
                    <p className="mt-1 text-2xl font-black text-white">
                      {kitchenOrders.length}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <p className="font-mono text-[10px] uppercase text-slate-400">
                      Gross Revenue
                    </p>
                    <p className="mt-1 text-2xl font-black text-emerald-400">
                      {formatCurrency(revenue, currency)}
                    </p>
                  </div>
                </div>

                {/* Mapped Virtual Brands */}
                <div className="mt-4">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Authorized Virtual Brands ({activeBrands.length})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {activeBrands.length ===
                    0 ? (
                      <span className="text-xs text-slate-500">
                        No brands currently authorized for this facility.
                      </span>
                    ) : (
                      activeBrands.map((b) => (
                        <span
                          key={b}
                          className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 font-mono text-xs font-bold text-sky-300"
                        >
                          {b}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Assigned Personnel */}
                <div className="mt-4 border-t border-slate-800 pt-3">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Assigned Personnel ({staff.length})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {staff.map((emp) => (
                      <span
                        key={emp.id}
                        className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-xs text-slate-300"
                      >
                        <strong>
                          {emp.name}
                        </strong>{" "}
                        <span className="font-mono text-[10px] text-emerald-400">
                          ({emp.role} •{" "}
                          {emp.employeeCode})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
