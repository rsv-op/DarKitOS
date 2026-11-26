"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import HardwareScanScaleInput from "@/components/HardwareScanScaleInput";
import RealtimeSyncBadge from "@/components/RealtimeSyncBadge";
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

function getStockStatus(item: InventoryItem): {
  label: "Healthy" | "Low Stock" | "Critical" | "Out of Stock";
  badge: string;
} {
  if (item.currentStock <= 0) {
    return {
      label: "Out of Stock",
      badge: "border-red-500/40 bg-red-500/15 text-red-300",
    };
  }
  if (item.currentStock <= item.reorderThreshold * 0.5) {
    return {
      label: "Critical",
      badge: "border-red-500/40 bg-red-500/10 text-red-300",
    };
  }
  if (item.currentStock <= item.reorderThreshold) {
    return {
      label: "Low Stock",
      badge: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    };
  }
  return {
    label: "Healthy",
    badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  };
}

function movementBadgeClass(type: InventoryMovement["type"]): string {
  if (type === "RESTOCK" || type === "CANCELLATION_RESTORE") {
    return "bg-emerald-500/20 text-emerald-300";
  }
  if (type === "WASTE" || type === "LOSS") {
    return "bg-red-500/20 text-red-300";
  }
  if (type === "TRANSFER_IN") {
    return "bg-teal-500/20 text-teal-300";
  }
  if (type === "TRANSFER_OUT") {
    return "bg-violet-500/20 text-violet-300";
  }
  return "bg-sky-500/20 text-sky-300";
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

  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [mutationAction, setMutationAction] = useState<
    "RESTOCK" | "MANUAL_ADJUSTMENT" | "WASTE" | "LOSS" | "SET_STOCK"
  >("RESTOCK");
  const [quantityInput, setQuantityInput] = useState<number>(25);
  const [reasonInput, setReasonInput] = useState(
    "Scheduled supplier delivery restock",
  );

  // Inter-Kitchen Stock Transfer state
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
      .catch(() => {
        // ignore transient error
      });

    const onSettingsUpdated = (event: Event) => {
      const custom = event as CustomEvent<SystemSettings>;
      if (custom.detail?.currency) setCurrency(custom.detail.currency);
    };
    window.addEventListener("darkit:settings-updated", onSettingsUpdated);
    return () => {
      active = false;
      window.removeEventListener("darkit:settings-updated", onSettingsUpdated);
    };
  }, []);

  const loadInventory = useCallback(async () => {
    try {
      const query =
        selectedKitchenId && selectedKitchenId !== "ALL"
          ? `?kitchenId=${encodeURIComponent(selectedKitchenId)}`
          : "?kitchenId=ALL";
      const res = await fetch(`/api/inventory${query}`, {
        cache: "no-store",
      });
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
          list.find(
            (i) => i.id === prev.id && i.kitchenId === prev.kitchenId,
          ) ?? null
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
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
    return Array.from(map.values());
  }, [inventory]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventory.filter((item) => {
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
  }, [inventory, search, categoryFilter, statusFilter]);

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Inventory update rejected.");
      }
      setNotice(
        `Updated [${data.item.kitchenId}] ${data.item.name} (${data.item.sku}): ${data.movement.previousStock} → ${data.item.currentStock} ${data.item.unit} (${data.movement.type}).`,
      );
      setSelectedItem(data.item);
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
        headers: {
          "Content-Type": "application/json",
        },
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
        `Transferred ${transferQty} ${data.fromItem.unit} ${data.fromItem.name} from ${transferFromKitchenId} (${data.fromItem.currentStock} left) → ${transferToKitchenId} (${data.toItem.currentStock} now) • Group ${data.transferGroupId}.`,
      );
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
      subtitle="Per-kitchen isolated stock ledgers (K1–K4), atomic recipe depletion, and hub-to-hub stock transfers."
      actions={
        <>
          <RealtimeSyncBadge
            connectionMode={realtimeSync.connectionMode}
            lastEventAt={realtimeSync.lastEventAt}
            topic={realtimeSync.topic}
          />
          <button
            type="button"
            onClick={() => void loadInventory()}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 font-mono text-xs font-bold text-white hover:bg-slate-700"
          >
            ↻ Refresh Ledger
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Per-Kitchen Scope Selector */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-sky-400">
                Per-Kitchen Stock Ledger Scope
              </p>
              <p className="text-xs text-slate-400">
                {isGlobalUser
                  ? "Select an individual dark kitchen hub or view all 4 hubs simultaneously."
                  : `Scoped strictly to your assigned kitchen hub (${currentEmployee?.kitchenId}).`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isGlobalUser && (
                <button
                  type="button"
                  onClick={() => setSelectedKitchenId("ALL")}
                  className={`rounded-xl border px-3 py-1.5 font-mono text-xs font-bold transition ${
                    selectedKitchenId === "ALL"
                      ? "border-sky-400 bg-sky-500/20 text-sky-200"
                      : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600"
                  }`}
                >
                  ALL HUBS
                </button>
              )}
              {kitchens
                .filter(
                  (k) => isGlobalUser || k.id === currentEmployee?.kitchenId,
                )
                .map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setSelectedKitchenId(k.id)}
                    className={`rounded-xl border px-3 py-1.5 font-mono text-xs font-bold transition ${
                      selectedKitchenId === k.id
                        ? "border-sky-400 bg-sky-500/20 text-sky-200"
                        : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    {k.id} · {k.code}
                  </button>
                ))}
            </div>
          </div>
        </section>

        {/* Sprint 4: Hardware Barcode Scanner & USB HID Weighing Scale Station */}
        {canManageInventory && (
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
        )}

        {/* Summary KPIs */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="font-mono text-[10px] font-bold uppercase text-slate-400">
              Tracked Stock Rows
            </p>
            <p className="mt-1 text-2xl font-black text-white">
              {stats.totalSkus}
            </p>
          </div>
          <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4">
            <p className="font-mono text-[10px] font-bold uppercase text-sky-300">
              Stock Valuation
            </p>
            <p className="mt-1 text-2xl font-black text-white">
              {fmt(stats.totalValuation)}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <p className="font-mono text-[10px] font-bold uppercase text-emerald-300">
              Healthy Stock
            </p>
            <p className="mt-1 text-2xl font-black text-white">
              {stats.healthy}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="font-mono text-[10px] font-bold uppercase text-amber-300">
              Low Stock Watch
            </p>
            <p className="mt-1 text-2xl font-black text-white">
              {stats.lowStock}
            </p>
          </div>
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
            <p className="font-mono text-[10px] font-bold uppercase text-red-300">
              Out of Stock
            </p>
            <p className="mt-1 text-2xl font-black text-white">
              {stats.outOfStock}
            </p>
          </div>
        </section>

        {/* Search & Filter Controls */}
        <section className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-3">
          <label className="block">
            <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
              Search SKU, Ingredient, or Kitchen
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="BEEF-01, Brioche, Tuna, K2..."
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </label>

          <label className="block">
            <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
              Category
            </span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
              Stock Health Status
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="ALL">All Health States</option>
              <option value="LOW">Low Stock (&lt;= Reorder Threshold)</option>
              <option value="HEALTHY">Healthy (&gt; Reorder Threshold)</option>
              <option value="OUT">Out of Stock (0)</option>
            </select>
          </label>
        </section>

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

        {/* Main Grid: Inventory Table + Adjustment & Inter-Kitchen Transfer Workstations */}
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden">
            {loading ? (
              <div className="p-10 text-center font-mono text-sm text-slate-400">
                Loading canonical inventory...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">
                No inventory items found matching your filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-950 font-mono text-[10px] uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-3.5">Hub</th>
                      <th className="px-4 py-3.5">SKU / Ingredient</th>
                      <th className="px-4 py-3.5">Category</th>
                      <th className="px-4 py-3.5">Current Stock</th>
                      <th className="px-4 py-3.5">Reorder Level</th>
                      <th className="px-4 py-3.5">Unit Cost</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5 text-right">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredItems.map((item) => {
                      const status = getStockStatus(item);
                      const rowKey = `${item.kitchenId ?? "K1"}-${item.id}`;
                      const isSelected =
                        selectedItem?.id === item.id &&
                        selectedItem?.kitchenId === item.kitchenId;
                      return (
                        <tr
                          key={rowKey}
                          onClick={() => {
                            setSelectedItem(item);
                            setQuantityInput(25);
                          }}
                          className={`cursor-pointer transition ${
                            isSelected
                              ? "bg-sky-500/10"
                              : "hover:bg-slate-950/60"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-300">
                              {item.kitchenId ?? "K1"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-white">{item.name}</p>
                            <p className="font-mono text-[10px] text-slate-400">
                              {item.sku} • {item.id}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {item.category}
                          </td>
                          <td className="px-4 py-3 font-mono text-sm font-black text-white">
                            {item.currentStock}{" "}
                            <span className="text-xs font-normal text-slate-400">
                              {item.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-400">
                            {item.reorderThreshold} {item.unit}
                          </td>
                          <td className="px-4 py-3 font-mono text-emerald-400">
                            {fmt(item.costPerUnit)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${status.badge}`}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {canManageInventory ? (
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void executeMutation(
                                    item,
                                    "RESTOCK",
                                    25,
                                    `Quick +25 station restock (${item.kitchenId ?? "K1"})`,
                                  );
                                }}
                                className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/30"
                              >
                                +25 Restock
                              </button>
                            ) : (
                              <span className="font-mono text-[10px] text-slate-500">
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

          {/* Right Column: Adjustment Workstation + Inter-Kitchen Stock Transfer */}
          <div className="space-y-6">
            <aside className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 h-fit">
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-sky-400">
                Inventory Adjustment Workstation
              </h2>
              {!selectedItem ? (
                <p className="mt-4 rounded-xl bg-slate-950 p-6 text-center text-xs text-slate-400">
                  Select any ingredient row on the left to perform authorized
                  restocks, manual stock counts, or waste/loss logging for that
                  specific kitchen hub.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-white">
                        {selectedItem.name}
                      </span>
                      <span className="rounded bg-sky-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-300">
                        {selectedItem.kitchenId ?? "K1"} · {selectedItem.sku}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-400">
                      Current Stock:{" "}
                      <strong className="text-white">
                        {selectedItem.currentStock} {selectedItem.unit}
                      </strong>{" "}
                      (Threshold: {selectedItem.reorderThreshold}{" "}
                      {selectedItem.unit})
                    </p>
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] font-bold uppercase text-slate-400">
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
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white"
                    >
                      <option value="RESTOCK">
                        RESTOCK (+ Add Incoming Stock)
                      </option>
                      <option value="SET_STOCK">
                        SET EXACT PHYSICAL STOCK COUNT
                      </option>
                      <option value="WASTE">
                        WASTE (− Deduct Trim / Prep Waste)
                      </option>
                      <option value="LOSS">
                        LOSS (− Deduct Spoilage / Damage)
                      </option>
                      <option value="MANUAL_ADJUSTMENT">
                        MANUAL ADJUSTMENT (+ / − Delta)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] font-bold uppercase text-slate-400">
                      {mutationAction === "SET_STOCK"
                        ? `New Exact Stock (${selectedItem.unit})`
                        : `Quantity (${selectedItem.unit})`}
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={quantityInput}
                      onChange={(e) => setQuantityInput(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] font-bold uppercase text-slate-400">
                      Audit Reason
                    </label>
                    <input
                      type="text"
                      value={reasonInput}
                      onChange={(e) => setReasonInput(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white"
                    />
                  </div>

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
                    className="w-full rounded-xl bg-sky-500 py-3 font-mono text-xs font-black uppercase tracking-wider text-slate-950 hover:bg-sky-400 disabled:opacity-50"
                  >
                    {submitting
                      ? "Recording Movement..."
                      : `Execute ${mutationAction.replaceAll("_", " ")} (${selectedItem.kitchenId ?? "K1"})`}
                  </button>
                </div>
              )}
            </aside>

            {/* Inter-Kitchen Stock Transfer Panel */}
            {canManageInventory && isGlobalUser && (
              <aside className="rounded-2xl border border-violet-500/30 bg-slate-900/80 p-5 h-fit">
                <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-violet-300">
                  Inter-Kitchen Stock Transfer
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Atomically move ingredients between hubs with paired{" "}
                  <code className="text-violet-300">TRANSFER_OUT</code> and{" "}
                  <code className="text-teal-300">TRANSFER_IN</code> audit rows.
                </p>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block font-mono text-[10px] font-bold uppercase text-slate-400">
                      Ingredient SKU
                    </label>
                    <select
                      value={transferItemId}
                      onChange={(e) => setTransferItemId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    >
                      {uniqueIngredientCatalog.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} ({ing.sku} · {ing.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-mono text-[10px] font-bold uppercase text-slate-400">
                        From Hub
                      </label>
                      <select
                        value={transferFromKitchenId}
                        onChange={(e) =>
                          setTransferFromKitchenId(e.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                      >
                        {kitchens.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.id} · {k.code}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] font-bold uppercase text-slate-400">
                        To Hub
                      </label>
                      <select
                        value={transferToKitchenId}
                        onChange={(e) => setTransferToKitchenId(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
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
                    <label className="block font-mono text-[10px] font-bold uppercase text-slate-400">
                      Transfer Quantity
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={transferQty}
                      onChange={(e) => setTransferQty(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] font-bold uppercase text-slate-400">
                      Transfer Note
                    </label>
                    <input
                      type="text"
                      value={transferReason}
                      onChange={(e) => setTransferReason(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={
                      submitting ||
                      transferFromKitchenId === transferToKitchenId ||
                      transferQty <= 0
                    }
                    onClick={() => void executeTransfer()}
                    className="w-full rounded-xl bg-violet-500 py-3 font-mono text-xs font-black uppercase tracking-wider text-slate-950 hover:bg-violet-400 disabled:opacity-50"
                  >
                    {submitting
                      ? "Transferring Stock..."
                      : `Transfer ${transferFromKitchenId} → ${transferToKitchenId}`}
                  </button>
                </div>
              </aside>
            )}
          </div>
        </div>

        {/* Inventory Movement & Consumption Audit Trail */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">
                Canonical Inventory Movement & Depletion Audit Trail
              </h2>
              <p className="text-xs text-slate-400">
                Tracks every SALE_CONSUMPTION, RESTOCK, MANUAL_ADJUSTMENT,
                WASTE, LOSS, CANCELLATION_RESTORE, TRANSFER_OUT, and TRANSFER_IN
                event.
              </p>
            </div>
            <span className="font-mono text-xs text-slate-400">
              {movements.length} recorded movements
            </span>
          </div>

          {movements.length === 0 ? (
            <p className="text-xs text-slate-500">
              No inventory movements recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950 font-mono text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5">Hub</th>
                    <th className="px-3 py-2.5">Movement Type</th>
                    <th className="px-3 py-2.5">Ingredient (SKU)</th>
                    <th className="px-3 py-2.5">Delta</th>
                    <th className="px-3 py-2.5">Stock Change</th>
                    <th className="px-3 py-2.5">Cost Impact</th>
                    <th className="px-3 py-2.5">Actor & Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {movements.slice(0, 20).map((mov) => (
                    <tr key={mov.id}>
                      <td className="px-3 py-2.5 font-mono text-[10px] font-bold text-sky-300">
                        {mov.kitchenId}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[10px] font-bold">
                        <span
                          className={`rounded px-2 py-0.5 ${movementBadgeClass(mov.type)}`}
                        >
                          {mov.type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-white">
                        {mov.itemName}{" "}
                        <span className="font-mono text-[10px] text-slate-400">
                          ({mov.sku})
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-200">
                        {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}{" "}
                        {mov.unit}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-400">
                        {mov.previousStock} →{" "}
                        <strong className="text-white">{mov.newStock}</strong>{" "}
                        {mov.unit}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-amber-300">
                        {fmt(mov.costImpact)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">
                        <p>{mov.reason}</p>
                        <p className="font-mono text-[10px] text-slate-500">
                          By {mov.actor}
                          {mov.transferGroupId
                            ? ` • Group ${mov.transferGroupId}`
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
    </AppShell>
  );
}
