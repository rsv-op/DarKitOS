"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import AppShell from "@/components/AppShell";
import type {
  InventoryItem,
  InventoryMovement,
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
  label:
    | "Healthy"
    | "Low Stock"
    | "Critical"
    | "Out of Stock";
  badge: string;
} {
  if (item.currentStock <= 0) {
    return {
      label: "Out of Stock",
      badge:
        "border-red-500/40 bg-red-500/15 text-red-300",
    };
  }
  if (
    item.currentStock <=
    item.reorderThreshold * 0.5
  ) {
    return {
      label: "Critical",
      badge:
        "border-red-500/40 bg-red-500/10 text-red-300",
    };
  }
  if (
    item.currentStock <= item.reorderThreshold
  ) {
    return {
      label: "Low Stock",
      badge:
        "border-amber-500/40 bg-amber-500/10 text-amber-300",
    };
  }
  return {
    label: "Healthy",
    badge:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  };
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<
    InventoryItem[]
  >([]);
  const [movements, setMovements] = useState<
    InventoryMovement[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] =
    useState<string>("ALL");
  const [statusFilter, setStatusFilter] =
    useState<string>("ALL");

  const [selectedItem, setSelectedItem] =
    useState<InventoryItem | null>(null);
  const [mutationAction, setMutationAction] =
    useState<
      | "RESTOCK"
      | "MANUAL_ADJUSTMENT"
      | "WASTE"
      | "LOSS"
      | "SET_STOCK"
    >("RESTOCK");
  const [quantityInput, setQuantityInput] =
    useState<number>(25);
  const [reasonInput, setReasonInput] =
    useState(
      "Scheduled supplier delivery restock",
    );
  const [submitting, setSubmitting] =
    useState(false);

  const loadInventory =
    useCallback(async () => {
      try {
        const res = await fetch(
          "/api/inventory",
          {
            cache: "no-store",
          },
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data.error ||
              "Unable to load inventory.",
          );
        }
        const list = Array.isArray(
          data.inventory,
        )
          ? (data.inventory as InventoryItem[])
          : [];
        setInventory(list);
        setMovements(
          Array.isArray(data.movements)
            ? (data.movements as InventoryMovement[])
            : [],
        );
        setError("");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load inventory.",
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventory.filter((item) => {
      if (
        categoryFilter !== "ALL" &&
        item.category !== categoryFilter
      )
        return false;
      const st = getStockStatus(item).label;
      if (
        statusFilter === "LOW" &&
        item.currentStock >
          item.reorderThreshold
      )
        return false;
      if (
        statusFilter === "HEALTHY" &&
        item.currentStock <=
          item.reorderThreshold
      )
        return false;
      if (
        statusFilter === "OUT" &&
        item.currentStock > 0
      )
        return false;
      if (q) {
        return (
          item.name
            .toLowerCase()
            .includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.category
            .toLowerCase()
            .includes(q)
        );
      }
      void st;
      return true;
    });
  }, [
    inventory,
    search,
    categoryFilter,
    statusFilter,
  ]);

  const stats = useMemo(() => {
    const totalValuation = inventory.reduce(
      (sum, i) =>
        sum + i.currentStock * i.costPerUnit,
      0,
    );
    const lowStock = inventory.filter(
      (i) =>
        i.currentStock > 0 &&
        i.currentStock <= i.reorderThreshold,
    ).length;
    const outOfStock = inventory.filter(
      (i) => i.currentStock <= 0,
    ).length;
    const healthy =
      inventory.length - lowStock - outOfStock;
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
    action:
      | "RESTOCK"
      | "MANUAL_ADJUSTMENT"
      | "WASTE"
      | "LOSS"
      | "SET_STOCK",
    qty: number,
    reason: string,
  ) {
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const payload =
        action === "SET_STOCK"
          ? {
              id: item.id,
              action: "SET_STOCK",
              currentStock: qty,
              reason,
            }
          : {
              id: item.id,
              action,
              quantity: qty,
              reason,
            };

      const res = await fetch(
        "/api/inventory",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ||
            "Inventory update rejected.",
        );
      }
      setNotice(
        `Updated ${data.item.name} (${data.item.sku}): ${data.movement.previousStock} → ${data.item.currentStock} ${data.item.unit} (${data.movement.type}).`,
      );
      setSelectedItem(data.item);
      await loadInventory();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Inventory mutation failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Stock Control & Inventory Consumption Ledger"
      subtitle="Manage canonical physical stock levels, reorder thresholds, restocks, waste/loss adjustments, and audit real-time recipe depletion movements."
      actions={
        <button
          type="button"
          onClick={() => void loadInventory()}
          className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 font-mono text-xs font-bold text-white hover:bg-slate-700"
        >
          ↻ Refresh Ledger
        </button>
      }
    >
      <div className="space-y-6">
        {/* Summary KPIs */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="font-mono text-[10px] font-bold uppercase text-slate-400">
              Total SKUs
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
              $
              {stats.totalValuation.toFixed(2)}
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
              Search SKU or Ingredient
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="BEEF-01, Brioche, Tuna..."
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </label>

          <label className="block">
            <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
              Category
            </span>
            <select
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(
                  e.target.value,
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="ALL">
                All Categories
              </option>
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
              onChange={(e) =>
                setStatusFilter(e.target.value)
              }
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="ALL">
                All Health States
              </option>
              <option value="LOW">
                Low Stock (&lt;= Reorder
                Threshold)
              </option>
              <option value="HEALTHY">
                Healthy (&gt; Reorder Threshold)
              </option>
              <option value="OUT">
                Out of Stock (0)
              </option>
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

        {/* Main Grid: Inventory Table + Restock/Adjust Workstation */}
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
                      <th className="px-4 py-3.5">
                        SKU / Ingredient
                      </th>
                      <th className="px-4 py-3.5">
                        Category
                      </th>
                      <th className="px-4 py-3.5">
                        Current Stock
                      </th>
                      <th className="px-4 py-3.5">
                        Reorder Level
                      </th>
                      <th className="px-4 py-3.5">
                        Unit Cost
                      </th>
                      <th className="px-4 py-3.5">
                        Status
                      </th>
                      <th className="px-4 py-3.5 text-right">
                        Quick Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredItems.map(
                      (item) => {
                        const status =
                          getStockStatus(item);
                        const isSelected =
                          selectedItem?.id ===
                          item.id;
                        return (
                          <tr
                            key={item.id}
                            onClick={() => {
                              setSelectedItem(
                                item,
                              );
                              setQuantityInput(
                                25,
                              );
                            }}
                            className={`cursor-pointer transition ${
                              isSelected
                                ? "bg-sky-500/10"
                                : "hover:bg-slate-950/60"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <p className="font-bold text-white">
                                {item.name}
                              </p>
                              <p className="font-mono text-[10px] text-slate-400">
                                {item.sku} •{" "}
                                {item.id}
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
                              {
                                item.reorderThreshold
                              }{" "}
                              {item.unit}
                            </td>
                            <td className="px-4 py-3 font-mono text-emerald-400">
                              $
                              {item.costPerUnit.toFixed(
                                2,
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${status.badge}`}
                              >
                                {status.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                disabled={
                                  submitting
                                }
                                onClick={(
                                  e,
                                ) => {
                                  e.stopPropagation();
                                  void executeMutation(
                                    item,
                                    "RESTOCK",
                                    25,
                                    "Quick +25 station restock",
                                  );
                                }}
                                className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/30"
                              >
                                +25 Restock
                              </button>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Right: Inventory Mutation Workstation */}
          <aside className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 h-fit">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-sky-400">
              Inventory Adjustment Workstation
            </h2>
            {!selectedItem ? (
              <p className="mt-4 rounded-xl bg-slate-950 p-6 text-center text-xs text-slate-400">
                Select any ingredient row on the left to perform authorized restocks, manual stock counts, or waste/loss logging.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">
                      {selectedItem.name}
                    </span>
                    <span className="font-mono text-xs text-sky-400">
                      {selectedItem.sku}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-400">
                    Current Stock:{" "}
                    <strong className="text-white">
                      {
                        selectedItem.currentStock
                      }{" "}
                      {selectedItem.unit}
                    </strong>{" "}
                    (Threshold:{" "}
                    {
                      selectedItem.reorderThreshold
                    }{" "}
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
                    {mutationAction ===
                    "SET_STOCK"
                      ? `New Exact Stock (${selectedItem.unit})`
                      : `Quantity (${selectedItem.unit})`}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={quantityInput}
                    onChange={(e) =>
                      setQuantityInput(
                        Number(e.target.value),
                      )
                    }
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
                    onChange={(e) =>
                      setReasonInput(
                        e.target.value,
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white"
                  />
                </div>

                <button
                  type="button"
                  disabled={submitting}
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
                    : `Execute ${mutationAction.replaceAll("_", " ")}`}
                </button>
              </div>
            )}
          </aside>
        </div>

        {/* Inventory Movement & Consumption Audit Trail */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">
                Canonical Inventory Movement & Depletion Audit Trail
              </h2>
              <p className="text-xs text-slate-400">
                Tracks every SALE_CONSUMPTION, RESTOCK, MANUAL_ADJUSTMENT, WASTE, LOSS, and CANCELLATION_RESTORE event.
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
                    <th className="px-3 py-2.5">
                      Movement Type
                    </th>
                    <th className="px-3 py-2.5">
                      Ingredient (SKU)
                    </th>
                    <th className="px-3 py-2.5">
                      Delta
                    </th>
                    <th className="px-3 py-2.5">
                      Stock Change
                    </th>
                    <th className="px-3 py-2.5">
                      Cost Impact
                    </th>
                    <th className="px-3 py-2.5">
                      Actor & Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {movements
                    .slice(0, 15)
                    .map((mov) => (
                      <tr key={mov.id}>
                        <td className="px-3 py-2.5 font-mono text-[10px] font-bold">
                          <span
                            className={`rounded px-2 py-0.5 ${
                              mov.type ===
                                "RESTOCK" ||
                              mov.type ===
                                "CANCELLATION_RESTORE"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : mov.type ===
                                      "WASTE" ||
                                    mov.type ===
                                      "LOSS"
                                  ? "bg-red-500/20 text-red-300"
                                  : "bg-sky-500/20 text-sky-300"
                            }`}
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
                          {mov.quantity > 0
                            ? `+${mov.quantity}`
                            : mov.quantity}{" "}
                          {mov.unit}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-400">
                          {mov.previousStock} →{" "}
                          <strong className="text-white">
                            {mov.newStock}
                          </strong>{" "}
                          {mov.unit}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-amber-300">
                          $
                          {mov.costImpact.toFixed(
                            2,
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          <p>{mov.reason}</p>
                          <p className="font-mono text-[10px] text-slate-500">
                            By {mov.actor}
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
