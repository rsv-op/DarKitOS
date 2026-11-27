"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import HardwareScanScaleInput from "@/components/HardwareScanScaleInput";
import RealtimeSyncBadge from "@/components/RealtimeSyncBadge";
import { SplitInspector } from "@/components/SplitInspector";
import { useRealtimeKitchenSync } from "@/hooks/useRealtimeKitchenSync";
import { formatCurrency, type SupportedCurrency } from "@/lib/currency";
import {
  KITCHENS_DB,
  type Employee,
  type InventoryItem,
  type InventoryMovement,
  type KitchenConfig,
  type PermissionCode,
  type SystemSettings,
} from "@/lib/db";

const CATEGORIES: InventoryItem["category"][] = [
  "Protein",
  "Produce",
  "Dairy",
  "Packaging",
  "Sauce",
  "Dry Good",
];

type SortKey = "health" | "name" | "stock_asc" | "value_desc";

function getStockStatus(item: InventoryItem): {
  label: "Healthy" | "Low Stock" | "Critical" | "Out of Stock";
  rank: number;
  badge: string;
  barColor: string;
} {
  if (item.currentStock <= 0) {
    return {
      label: "Out of Stock",
      rank: 0,
      badge: "border-rose-500/40 bg-rose-500/15 text-rose-300",
      barColor: "bg-rose-500",
    };
  }
  if (item.currentStock <= item.reorderThreshold * 0.5) {
    return {
      label: "Critical",
      rank: 1,
      badge: "border-rose-500/35 bg-rose-500/10 text-rose-300",
      barColor: "bg-rose-400",
    };
  }
  if (item.currentStock <= item.reorderThreshold) {
    return {
      label: "Low Stock",
      rank: 2,
      badge: "border-amber-500/35 bg-amber-500/10 text-amber-300",
      barColor: "bg-amber-400",
    };
  }
  return {
    label: "Healthy",
    rank: 3,
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    barColor: "bg-emerald-400",
  };
}

function movementBadgeClass(type: InventoryMovement["type"]): string {
  if (type === "RESTOCK" || type === "CANCELLATION_RESTORE") {
    return "bg-emerald-500/15 text-emerald-300";
  }
  if (type === "WASTE" || type === "LOSS") {
    return "bg-rose-500/15 text-rose-300";
  }
  if (type === "TRANSFER_IN") {
    return "bg-teal-500/15 text-teal-300";
  }
  if (type === "TRANSFER_OUT") {
    return "bg-violet-500/15 text-violet-300";
  }
  return "bg-sky-500/15 text-sky-300";
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [kitchens, setKitchens] = useState<KitchenConfig[]>(KITCHENS_DB);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [selectedKitchenId, setSelectedKitchenId] = useState<string>("K1");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("health");

  // Slide-over drawers
  const [scanOpen, setScanOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [mutationAction, setMutationAction] = useState<
    "RESTOCK" | "MANUAL_ADJUSTMENT" | "WASTE" | "LOSS" | "SET_STOCK"
  >("RESTOCK");
  const [quantityInput, setQuantityInput] = useState<number>(25);
  const [reasonInput, setReasonInput] = useState(
    "Scheduled supplier delivery restock",
  );

  // Inter-Kitchen Transfer state
  const [transferItemId, setTransferItemId] = useState<string>("INV-002");
  const [transferFromKitchenId, setTransferFromKitchenId] =
    useState<string>("K2");
  const [transferToKitchenId, setTransferToKitchenId] = useState<string>("K1");
  const [transferQty, setTransferQty] = useState<number>(20);
  const [transferReason, setTransferReason] = useState<string>(
    "Rebalancing dinner rush stock between hubs",
  );

  const [submitting, setSubmitting] = useState(false);
  const [currency, setCurrency] = useState<SupportedCurrency>("INR");
  const [canManageInventory, setCanManageInventory] = useState<boolean>(true);

  const isGlobalUser =
    !currentEmployee ||
    currentEmployee.role === "OWNER" ||
    !currentEmployee.kitchenId;

  const fmt = useCallback(
    (amount: number) => formatCurrency(amount, currency),
    [currency],
  );

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/session", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch("/api/system", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : null,
      ),
    ])
      .then(([sessionData, systemData]) => {
        if (!active) return;
        if (sessionData) {
          if (sessionData.settings?.currency) {
            setCurrency(sessionData.settings.currency);
          }
          const perms = (sessionData.permissions || []) as PermissionCode[];
          setCanManageInventory(
            perms.includes("INVENTORY_MANAGE") || perms.includes("OWNER_VIEW"),
          );
          if (sessionData.employee) {
            const emp = sessionData.employee as Employee;
            setCurrentEmployee(emp);
            if (emp.role !== "OWNER" && emp.kitchenId) {
              setSelectedKitchenId(emp.kitchenId);
            }
          }
        }
        if (systemData && Array.isArray(systemData.kitchens)) {
          setKitchens(systemData.kitchens as KitchenConfig[]);
        }
      })
      .catch(() => {});

    const onSettingsUpdated = (event: Event) => {
      const custom = event as CustomEvent<SystemSettings>;
      if (custom.detail?.currency) setCurrency(custom.detail.currency);
    };
    const onHubChanged = (event: Event) => {
      const custom = event as CustomEvent<{ kitchenId?: string }>;
      if (custom.detail?.kitchenId) {
        setSelectedKitchenId(custom.detail.kitchenId);
      }
    };

    window.addEventListener("darkit:settings-updated", onSettingsUpdated);
    window.addEventListener("darkit:hub-changed", onHubChanged);
    return () => {
      active = false;
      window.removeEventListener("darkit:settings-updated", onSettingsUpdated);
      window.removeEventListener("darkit:hub-changed", onHubChanged);
    };
  }, []);

  const loadInventory = useCallback(async () => {
    try {
      const query =
        selectedKitchenId && selectedKitchenId !== "ALL"
          ? `?kitchenId=${encodeURIComponent(selectedKitchenId)}`
          : "?kitchenId=ALL";
      const res = await fetch(`/api/inventory${query}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to load inventory.");
      }
      const list = Array.isArray(data.inventory)
        ? (data.inventory as InventoryItem[])
        : [];
      setInventory(list);
      setMovements(
        Array.isArray(data.movements)
          ? (data.movements as InventoryMovement[])
          : [],
      );
      setSelectedItem((prev) => {
        if (!prev) return null;
        return (
          list.find((i) => i.id === prev.id && i.kitchenId === prev.kitchenId) ??
          null
        );
      });
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load inventory.",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedKitchenId]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const realtimeSync = useRealtimeKitchenSync({
    organizationId: currentEmployee?.organizationId,
    kitchenId:
      currentEmployee?.role !== "OWNER" && currentEmployee?.kitchenId
        ? currentEmployee.kitchenId
        : selectedKitchenId !== "ALL"
          ? selectedKitchenId
          : null,
    onSync: loadInventory,
  });

  const uniqueIngredientCatalog = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const item of inventory) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    return Array.from(map.values());
  }, [inventory]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = inventory.filter((item) => {
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) {
        return false;
      }
      if (statusFilter === "LOW" && item.currentStock > item.reorderThreshold) {
        return false;
      }
      if (
        statusFilter === "HEALTHY" &&
        item.currentStock <= item.reorderThreshold
      ) {
        return false;
      }
      if (statusFilter === "OUT" && item.currentStock > 0) {
        return false;
      }
      if (q) {
        return (
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.kitchenId || "").toLowerCase().includes(q)
        );
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "stock_asc") return a.currentStock - b.currentStock;
      if (sortBy === "value_desc") {
        return (
          b.currentStock * b.costPerUnit - a.currentStock * a.costPerUnit
        );
      }
      const rankDiff = getStockStatus(a).rank - getStockStatus(b).rank;
      return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name);
    });
  }, [inventory, search, categoryFilter, statusFilter, sortBy]);

  const stats = useMemo(() => {
    const totalValuation = inventory.reduce(
      (sum, i) => sum + i.currentStock * i.costPerUnit,
      0,
    );
    const lowStock = inventory.filter(
      (i) => i.currentStock > 0 && i.currentStock <= i.reorderThreshold,
    ).length;
    const outOfStock = inventory.filter((i) => i.currentStock <= 0).length;
    const healthy = inventory.length - lowStock - outOfStock;
    return {
      totalSkus: inventory.length,
      totalValuation,
      healthy,
      lowStock,
      outOfStock,
    };
  }, [inventory]);

  async function executeMutation(
    item: InventoryItem,
    action: "RESTOCK" | "MANUAL_ADJUSTMENT" | "WASTE" | "LOSS" | "SET_STOCK",
    qty: number,
    reason: string,
  ) {
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const targetKitchen =
        item.kitchenId ||
        (selectedKitchenId !== "ALL" ? selectedKitchenId : "K1");
      const payload =
        action === "SET_STOCK"
          ? {
              id: item.id,
              kitchenId: targetKitchen,
              action: "SET_STOCK",
              currentStock: qty,
              reason,
            }
          : {
              id: item.id,
              kitchenId: targetKitchen,
              action,
              quantity: qty,
              reason,
            };

      const res = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Inventory update rejected.");
      }
      setNotice(
        `[${data.item.kitchenId}] ${data.item.name} (${data.item.sku}): ${data.movement.previousStock} -> ${data.item.currentStock} ${data.item.unit} (${data.movement.type}).`,
      );
      setSelectedItem((prev) => (prev ? data.item : null));
      await loadInventory();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Inventory mutation failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function executeTransfer() {
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TRANSFER",
          itemId: transferItemId,
          fromKitchenId: transferFromKitchenId,
          toKitchenId: transferToKitchenId,
          quantity: transferQty,
          reason: transferReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Inter-kitchen transfer rejected.");
      }
      setNotice(
        `Transferred ${transferQty} ${data.fromItem.unit} ${data.fromItem.name}: ${transferFromKitchenId} (${data.fromItem.currentStock} left) -> ${transferToKitchenId} (${data.toItem.currentStock} now).`,
      );
      setTransferOpen(false);
      await loadInventory();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Inter-kitchen transfer failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Inventory"
      subtitle={`Scope: ${selectedKitchenId}`}
      activeHub={selectedKitchenId}
      onHubChange={setSelectedKitchenId}
      rightActions={
        <>
          <RealtimeSyncBadge
            connectionMode={realtimeSync.connectionMode}
            lastEventAt={realtimeSync.lastEventAt}
            topic={realtimeSync.topic}
          />
          {canManageInventory && (
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              className="inline-flex h-7 items-center rounded-md border border-indigo-500/40 bg-indigo-500/15 px-2.5 text-[11px] font-medium text-indigo-200 transition-colors hover:bg-indigo-500/25"
            >
              Scan / Scale
            </button>
          )}
          {canManageInventory && isGlobalUser && (
            <button
              type="button"
              onClick={() => setTransferOpen(true)}
              className="inline-flex h-7 items-center rounded-md border border-white/[0.1] bg-[#151519] px-2.5 text-[11px] font-medium text-zinc-200 transition-colors hover:border-white/[0.2] hover:text-white"
            >
              Transfer Stock
            </button>
          )}
          <button
            type="button"
            onClick={() => void loadInventory()}
            className="inline-flex h-7 items-center rounded-md border border-white/[0.08] bg-[#151519] px-2.5 text-[11px] font-medium text-zinc-300 hover:border-white/[0.16] hover:text-zinc-100"
          >
            Refresh
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Hairline Metric Strip */}
        <section className="grid grid-cols-2 divide-y divide-white/[0.06] overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519] sm:grid-cols-5 sm:divide-x sm:divide-y-0">
          <div className="px-4 py-3">
            <p className="text-[11px] font-medium text-zinc-400">Stock Rows</p>
            <p className="mt-1 font-mono text-lg font-semibold text-zinc-100 tabular-nums">
              {stats.totalSkus}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] font-medium text-zinc-400">
              INR Valuation
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-emerald-300 tabular-nums">
              {fmt(stats.totalValuation)}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] font-medium text-zinc-400">Healthy</p>
            <p className="mt-1 font-mono text-lg font-semibold text-zinc-100 tabular-nums">
              {stats.healthy}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] font-medium text-zinc-400">Low Stock</p>
            <p className="mt-1 font-mono text-lg font-semibold text-amber-300 tabular-nums">
              {stats.lowStock}
            </p>
          </div>
          <div className="col-span-2 px-4 py-3 sm:col-span-1">
            <p className="text-[11px] font-medium text-zinc-400">Out of Stock</p>
            <p className="mt-1 font-mono text-lg font-semibold text-rose-300 tabular-nums">
              {stats.outOfStock}
            </p>
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
            {error}
          </div>
        )}

        {notice && (
          <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200">
            {notice}
          </div>
        )}

        {/* Dense Sortable Hairline Stock Table */}
        <section className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519]/60">
          {/* Inline Filter & Sort Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-[#09090b]/40 px-4 py-2.5">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU, ingredient, hub..."
              className="h-7 min-w-[200px] flex-1 rounded-md border border-white/[0.08] bg-[#151519] px-2.5 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-white/[0.2]"
            />

            <select
              aria-label="Category filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-7 rounded-md border border-white/[0.08] bg-[#151519] px-2 text-[11px] text-zinc-200"
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              aria-label="Health filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-7 rounded-md border border-white/[0.08] bg-[#151519] px-2 text-[11px] text-zinc-200"
            >
              <option value="ALL">All States</option>
              <option value="LOW">Low Stock</option>
              <option value="HEALTHY">Healthy</option>
              <option value="OUT">Out of Stock</option>
            </select>

            <select
              aria-label="Sort inventory"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="h-7 rounded-md border border-white/[0.08] bg-[#151519] px-2 text-[11px] text-zinc-200"
            >
              <option value="health">Sort: Risk First</option>
              <option value="name">Sort: Name A–Z</option>
              <option value="stock_asc">Sort: Lowest Stock</option>
              <option value="value_desc">Sort: Highest Valuation</option>
            </select>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-500">
              Loading stock ledger...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500">
              No inventory rows match your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-[#09090b]/40 text-[11px] font-medium text-zinc-500">
                    <th className="px-4 py-2">Hub</th>
                    <th className="px-4 py-2">SKU / Ingredient</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Stock &amp; Threshold</th>
                    <th className="px-4 py-2 text-right">Unit Cost</th>
                    <th className="px-4 py-2 text-right">Valuation</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2 text-right">Inline Adjust</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filteredItems.map((item) => {
                    const status = getStockStatus(item);
                    const rowKey = `${item.kitchenId ?? "K1"}-${item.id}`;
                    const pct = Math.min(
                      100,
                      Math.max(
                        0,
                        item.reorderThreshold > 0
                          ? (item.currentStock / (item.reorderThreshold * 2)) *
                              100
                          : 100,
                      ),
                    );
                    const rowVal = item.currentStock * item.costPerUnit;

                    return (
                      <tr
                        key={rowKey}
                        onClick={() => {
                          setSelectedItem(item);
                          setQuantityInput(25);
                        }}
                        className="cursor-pointer transition-colors hover:bg-[#1d1d22]/60"
                      >
                        <td className="px-4 py-2.5">
                          <span className="rounded bg-[#1d1d22] px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-300">
                            {item.kitchenId ?? "K1"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-zinc-100">
                            {item.name}
                          </p>
                          <p className="font-mono text-[10px] text-zinc-500">
                            {item.sku} · {item.id}
                          </p>
                        </td>
                        <td className="px-4 py-2.5 text-zinc-400">
                          {item.category}
                        </td>
                        <td className="min-w-[160px] px-4 py-2.5">
                          <div className="flex items-baseline justify-between font-mono tabular-nums">
                            <span className="font-semibold text-zinc-100">
                              {item.currentStock} {item.unit}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              min {item.reorderThreshold}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className={`h-full rounded-full transition-all ${status.barColor}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-zinc-300 tabular-nums">
                          {fmt(item.costPerUnit)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-medium text-zinc-100 tabular-nums">
                          {fmt(rowVal)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-block rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium ${status.badge}`}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td
                          className="px-4 py-2.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {canManageInventory ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                disabled={submitting || item.currentStock <= 0}
                                onClick={() =>
                                  void executeMutation(
                                    item,
                                    "MANUAL_ADJUSTMENT",
                                    -1,
                                    `Inline -1 adjustment (${item.kitchenId ?? "K1"})`,
                                  )
                                }
                                aria-label={`Decrease ${item.name}`}
                                className="flex h-6 w-6 items-center justify-center rounded border border-white/[0.08] bg-[#151519] font-mono text-xs text-zinc-300 hover:border-white/[0.2] hover:text-white disabled:opacity-40"
                              >
                                −
                              </button>
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() =>
                                  void executeMutation(
                                    item,
                                    "RESTOCK",
                                    1,
                                    `Inline +1 restock (${item.kitchenId ?? "K1"})`,
                                  )
                                }
                                aria-label={`Increase ${item.name}`}
                                className="flex h-6 w-6 items-center justify-center rounded border border-white/[0.08] bg-[#151519] font-mono text-xs text-zinc-300 hover:border-white/[0.2] hover:text-white disabled:opacity-40"
                              >
                                +
                              </button>
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() =>
                                  void executeMutation(
                                    item,
                                    "RESTOCK",
                                    25,
                                    `Quick +25 restock (${item.kitchenId ?? "K1"})`,
                                  )
                                }
                                className="h-6 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 font-mono text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
                              >
                                +25
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono text-[10px] text-zinc-500">
                              Read-only
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Canonical Movement Audit Trail */}
        <section className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519]/60">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
            <h2 className="text-xs font-semibold text-zinc-200">
              Inventory Movement &amp; Depletion Audit Trail
            </h2>
            <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
              {movements.length} movements
            </span>
          </div>
          {movements.length === 0 ? (
            <p className="px-4 py-6 text-xs text-zinc-500">
              No inventory movements recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-[#09090b]/40 text-[11px] font-medium text-zinc-500">
                    <th className="px-4 py-2">Hub</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Ingredient</th>
                    <th className="px-4 py-2 text-right">Delta</th>
                    <th className="px-4 py-2 text-right">Balance</th>
                    <th className="px-4 py-2 text-right">Cost Impact</th>
                    <th className="px-4 py-2">Actor &amp; Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {movements.slice(0, 20).map((mov) => (
                    <tr key={mov.id} className="hover:bg-[#1d1d22]/40">
                      <td className="px-4 py-2 font-mono text-[11px] text-zinc-300">
                        {mov.kitchenId}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-medium ${movementBadgeClass(mov.type)}`}
                        >
                          {mov.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-medium text-zinc-100">
                        {mov.itemName}{" "}
                        <span className="font-mono text-[10px] text-zinc-500">
                          {mov.sku}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-medium text-zinc-200 tabular-nums">
                        {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}{" "}
                        {mov.unit}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-400 tabular-nums">
                        {mov.previousStock} →{" "}
                        <span className="text-zinc-100">{mov.newStock}</span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-amber-300 tabular-nums">
                        {fmt(mov.costImpact)}
                      </td>
                      <td className="px-4 py-2 text-zinc-400">
                        <p className="text-zinc-200">{mov.reason}</p>
                        <p className="font-mono text-[10px] text-zinc-500">
                          {mov.actor}
                          {mov.transferGroupId
                            ? ` · ${mov.transferGroupId}`
                            : ""}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Slide-Over 1: Barcode Scanner & USB HID Weighing Scale Station */}
      <SplitInspector
        open={scanOpen}
        mode="overlay"
        widthClassName="max-w-[600px]"
        title="Barcode Scanner & USB Scale"
        subtitle={`Active Hub: ${selectedKitchenId === "ALL" ? (kitchens[0]?.id ?? "K1") : selectedKitchenId}`}
        onClose={() => setScanOpen(false)}
      >
        <HardwareScanScaleInput
          kitchenId={
            selectedKitchenId === "ALL"
              ? (kitchens[0]?.id ?? "K1")
              : selectedKitchenId
          }
          inventory={inventory}
          onCommitted={async (msg) => {
            setNotice(msg);
            await loadInventory();
          }}
        />
      </SplitInspector>

      {/* Slide-Over 2: Inter-Kitchen Stock Transfer */}
      <SplitInspector
        open={transferOpen}
        mode="overlay"
        title="Inter-Kitchen Stock Transfer"
        subtitle="Atomic TRANSFER_OUT / TRANSFER_IN movement pair"
        onClose={() => setTransferOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setTransferOpen(false)}
              className="h-8 rounded-md border border-white/[0.08] bg-[#151519] px-3 text-xs font-medium text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                submitting ||
                transferFromKitchenId === transferToKitchenId ||
                transferQty <= 0
              }
              onClick={() => void executeTransfer()}
              className="h-8 rounded-md bg-zinc-100 px-3 text-xs font-semibold text-zinc-950 hover:bg-white disabled:opacity-40"
            >
              {submitting
                ? "Transferring..."
                : `Transfer ${transferFromKitchenId} → ${transferToKitchenId}`}
            </button>
          </div>
        }
      >
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-400">
              Ingredient SKU
            </label>
            <select
              value={transferItemId}
              onChange={(e) => setTransferItemId(e.target.value)}
              className="h-8 w-full rounded-md border border-white/[0.08] bg-[#151519] px-2.5 text-xs text-zinc-100"
            >
              {uniqueIngredientCatalog.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} ({ing.sku} · {ing.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                From Hub
              </label>
              <select
                value={transferFromKitchenId}
                onChange={(e) => setTransferFromKitchenId(e.target.value)}
                className="h-8 w-full rounded-md border border-white/[0.08] bg-[#151519] px-2.5 text-xs text-zinc-100"
              >
                {kitchens.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.id} · {k.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                To Hub
              </label>
              <select
                value={transferToKitchenId}
                onChange={(e) => setTransferToKitchenId(e.target.value)}
                className="h-8 w-full rounded-md border border-white/[0.08] bg-[#151519] px-2.5 text-xs text-zinc-100"
              >
                {kitchens.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.id} · {k.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-400">
              Quantity
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={transferQty}
              onChange={(e) => setTransferQty(Number(e.target.value))}
              className="h-8 w-full rounded-md border border-white/[0.08] bg-[#151519] px-2.5 font-mono text-xs text-zinc-100 tabular-nums"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-400">
              Audit Note
            </label>
            <input
              type="text"
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              className="h-8 w-full rounded-md border border-white/[0.08] bg-[#151519] px-2.5 text-xs text-zinc-100"
            />
          </div>
        </div>
      </SplitInspector>

      {/* Slide-Over 3: Item Stock Adjustment Workstation */}
      <SplitInspector
        open={Boolean(selectedItem)}
        mode="overlay"
        title={selectedItem ? selectedItem.name : "Stock Adjustment"}
        subtitle={
          selectedItem
            ? `${selectedItem.kitchenId ?? "K1"} · ${selectedItem.sku} · Current ${selectedItem.currentStock} ${selectedItem.unit}`
            : undefined
        }
        onClose={() => setSelectedItem(null)}
        footer={
          selectedItem ? (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="h-8 rounded-md border border-white/[0.08] bg-[#151519] px-3 text-xs font-medium text-zinc-300"
              >
                Close
              </button>
              <button
                type="button"
                disabled={submitting || !canManageInventory}
                onClick={() =>
                  void executeMutation(
                    selectedItem,
                    mutationAction,
                    quantityInput,
                    reasonInput,
                  )
                }
                className="h-8 rounded-md bg-zinc-100 px-3 text-xs font-semibold text-zinc-950 hover:bg-white disabled:opacity-40"
              >
                {submitting
                  ? "Recording..."
                  : `Execute ${mutationAction.replaceAll("_", " ")}`}
              </button>
            </div>
          ) : undefined
        }
      >
        {selectedItem && (
          <div className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.06]">
              <div className="bg-[#151519] p-2.5">
                <p className="text-[10px] text-zinc-500">Current Stock</p>
                <p className="mt-0.5 font-mono font-semibold text-zinc-100 tabular-nums">
                  {selectedItem.currentStock} {selectedItem.unit}
                </p>
              </div>
              <div className="bg-[#151519] p-2.5">
                <p className="text-[10px] text-zinc-500">Reorder Threshold</p>
                <p className="mt-0.5 font-mono text-zinc-300 tabular-nums">
                  {selectedItem.reorderThreshold} {selectedItem.unit}
                </p>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                Operation Type
              </label>
              <select
                value={mutationAction}
                onChange={(e) =>
                  setMutationAction(
                    e.target.value as
                      | "RESTOCK"
                      | "MANUAL_ADJUSTMENT"
                      | "WASTE"
                      | "LOSS"
                      | "SET_STOCK",
                  )
                }
                className="h-8 w-full rounded-md border border-white/[0.08] bg-[#151519] px-2.5 text-xs text-zinc-100"
              >
                <option value="RESTOCK">RESTOCK (+ Add Incoming Stock)</option>
                <option value="SET_STOCK">SET EXACT PHYSICAL STOCK</option>
                <option value="WASTE">WASTE (− Prep / Trim Waste)</option>
                <option value="LOSS">LOSS (− Spoilage / Damage)</option>
                <option value="MANUAL_ADJUSTMENT">
                  MANUAL ADJUSTMENT (+ / − Delta)
                </option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                {mutationAction === "SET_STOCK"
                  ? `Exact Count (${selectedItem.unit})`
                  : `Quantity (${selectedItem.unit})`}
              </label>
              <input
                type="number"
                step="0.5"
                value={quantityInput}
                onChange={(e) => setQuantityInput(Number(e.target.value))}
                className="h-8 w-full rounded-md border border-white/[0.08] bg-[#151519] px-2.5 font-mono text-xs text-zinc-100 tabular-nums"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                Audit Reason
              </label>
              <input
                type="text"
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                className="h-8 w-full rounded-md border border-white/[0.08] bg-[#151519] px-2.5 text-xs text-zinc-100"
              />
            </div>
          </div>
        )}
      </SplitInspector>
    </AppShell>
  );
}
