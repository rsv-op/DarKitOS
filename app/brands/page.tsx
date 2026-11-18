"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import AppShell from "@/components/AppShell";
import {
  BRANDS_DB,
  KITCHENS_DB,
  type BrandConfig,
  type BrandKitchenConfig,
  type DbaBrand,
  type InventoryItem,
  type KitchenConfig,
  type KitchenStation,
  type MenuItem,
} from "@/lib/db";

const STATIONS: KitchenStation[] = [
  "Grill",
  "Fryer",
  "Assembly",
  "Cold Prep",
];

export default function BrandsPage() {
  const [brands, setBrands] =
    useState<BrandConfig[]>(BRANDS_DB);
  const [kitchens, setKitchens] = useState<
    KitchenConfig[]
  >(KITCHENS_DB);
  const [brandKitchens, setBrandKitchens] =
    useState<BrandKitchenConfig[]>([]);
  const [menuCatalog, setMenuCatalog] =
    useState<MenuItem[]>([]);
  const [inventory, setInventory] = useState<
    InventoryItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // New / Edit Menu Item form
  const [newBrandId, setNewBrandId] =
    useState<DbaBrand>("BurgerForge");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] =
    useState(13.99);
  const [newStation, setNewStation] =
    useState<KitchenStation>("Grill");
  const [newIngredientId, setNewIngredientId] =
    useState("INV-001");
  const [newIngredientQty, setNewIngredientQty] =
    useState(1);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/system", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ||
            "Unable to load brand configuration.",
        );
      }
      if (Array.isArray(data.brands))
        setBrands(data.brands);
      if (Array.isArray(data.kitchens))
        setKitchens(data.kitchens);
      if (Array.isArray(data.brandKitchens))
        setBrandKitchens(data.brandKitchens);
      if (Array.isArray(data.menuCatalog))
        setMenuCatalog(data.menuCatalog);
      if (Array.isArray(data.inventory))
        setInventory(data.inventory);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Load failed.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function toggleMatrixCell(
    brandId: DbaBrand,
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
          action: "TOGGLE_BRAND_KITCHEN",
          brandId,
          kitchenId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ||
            "Failed to toggle BrandKitchen matrix.",
        );
      }
      setBrandKitchens(data.brandKitchens);
      setNotice(
        `Updated canonical BrandKitchen mapping for ${brandId} ↔ ${kitchenId}. Order Injection will enforce this immediately.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Update failed.",
      );
    }
  }

  async function handleAddMenuItem(
    e: React.FormEvent,
  ) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError("");
    setNotice("");
    try {
      const item: MenuItem = {
        id: `MENU-${newBrandId.slice(0, 2).toUpperCase()}-${Date.now().toString().slice(-3)}`,
        brandId: newBrandId,
        name: newName.trim(),
        price: Number(newPrice) || 12.99,
        station: newStation,
        active: true,
        recipe:
          newIngredientQty > 0
            ? [
                {
                  inventoryItemId:
                    newIngredientId,
                  quantityRequired:
                    Number(newIngredientQty),
                },
              ]
            : [],
      };
      const res = await fetch("/api/system", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "UPSERT_MENU_ITEM",
          item,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ||
            "Failed to add menu item.",
        );
      }
      setMenuCatalog(data.menuCatalog);
      setNewName("");
      setNotice(
        `Added "${item.name}" ($${item.price.toFixed(2)}) to ${item.brandId} catalog.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save menu item.",
      );
    }
  }

  return (
    <AppShell
      title="Brands"
      subtitle="Manage the food brands and menus customers order from, and choose which kitchens can prepare each menu."
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

        {/* Virtual Brand Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {brands.map((brand) => {
            const assignedKitchens =
              brandKitchens.filter(
                (bk) =>
                  bk.brandId === brand.id &&
                  bk.active,
              );
            const brandMenu =
              menuCatalog.filter(
                (m) => m.brandId === brand.id,
              );
            return (
              <div
                key={brand.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-sky-500/10 border border-sky-500/30 px-2.5 py-0.5 font-mono text-xs font-bold text-sky-300">
                    DBA: {brand.code}
                  </span>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                    ACTIVE
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-black text-white">
                  {brand.name}
                </h2>
                <p className="text-xs text-slate-400">
                  {brand.tagline}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 font-mono text-xs">
                  <span className="text-slate-400">
                    Kitchens:{" "}
                    <strong className="text-white">
                      {assignedKitchens.length}
                    </strong>
                  </span>
                  <span className="text-slate-400">
                    Menu SKUs:{" "}
                    <strong className="text-emerald-400">
                      {brandMenu.length}
                    </strong>
                  </span>
                </div>
              </div>
            );
          })}
        </section>

        {/* Many-to-Many BrandKitchen Matrix */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-4">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-sky-400">
              Canonical BrandKitchen Topology
            </span>
            <h2 className="mt-1 text-lg font-black text-white">
              Many-to-Many Brand ↔ Physical Kitchen Production Matrix
            </h2>
            <p className="text-xs text-slate-400">
              Click any cell below to authorize or revoke a physical kitchen&apos;s permission to produce orders for a virtual brand. Server-side validation in{" "}
              <code>POST /api/orders</code>{" "}
              strictly enforces this table.
            </p>
          </div>

          {loading ? (
            <p className="text-xs text-slate-400">
              Loading matrix...
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950 font-mono text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">
                      Virtual Brand (DBA)
                    </th>
                    {kitchens.map((k) => (
                      <th
                        key={k.id}
                        className="px-4 py-3 text-center"
                      >
                        <div>
                          <span className="text-white font-bold">
                            {k.id}
                          </span>{" "}
                          ({k.code})
                        </div>
                        <div className="text-[9px] text-slate-500 font-normal">
                          {k.name}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {brands.map((brand) => (
                    <tr key={brand.id}>
                      <td className="px-4 py-3.5 font-bold text-white">
                        {brand.name}{" "}
                        <span className="font-mono text-[10px] text-slate-400">
                          ({brand.code})
                        </span>
                      </td>
                      {kitchens.map((kitchen) => {
                        const active =
                          brandKitchens.find(
                            (bk) =>
                              bk.brandId ===
                                brand.id &&
                              bk.kitchenId ===
                                kitchen.id,
                          )?.active ?? false;
                        return (
                          <td
                            key={kitchen.id}
                            className="px-4 py-3.5 text-center"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                void toggleMatrixCell(
                                  brand.id,
                                  kitchen.id,
                                )
                              }
                              className={`rounded-xl border px-3.5 py-2 font-mono text-[11px] font-bold transition ${
                                active
                                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                                  : "border-slate-800 bg-slate-950 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                              }`}
                            >
                              {active
                                ? "✓ AUTHORIZED"
                                : "✕ DISABLED"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Menu Catalog & Recipe Bill of Materials */}
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-lg font-black text-white mb-4">
              Menu Catalog & Recipe Bill of Materials ({menuCatalog.length} Items)
            </h2>
            <div className="space-y-3">
              {menuCatalog.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3.5"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-sky-400">
                        {item.brandId}
                      </span>
                      <span className="font-bold text-sm text-white">
                        {item.name}
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                        {item.station}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-slate-400">
                      Recipe BOM:{" "}
                      {item.recipe.length === 0
                        ? "Direct Station Prep"
                        : item.recipe
                            .map((r) => {
                              const inv =
                                inventory.find(
                                  (i) =>
                                    i.id ===
                                    r.inventoryItemId,
                                );
                              return `${r.quantityRequired} ${inv?.unit || "u"} ${inv?.name || r.inventoryItemId}`;
                            })
                            .join(" + ")}
                    </p>
                  </div>

                  <div className="text-right font-mono">
                    <span className="text-base font-black text-emerald-400">
                      ${item.price.toFixed(2)}
                    </span>
                    <p className="text-[10px] text-slate-500">
                      {item.id}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Add New Menu Item to Catalog */}
          <aside className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 h-fit">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
              Add New Brand Menu Item
            </h3>
            <form
              onSubmit={handleAddMenuItem}
              className="mt-4 space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400">
                  Virtual Brand
                </label>
                <select
                  value={newBrandId}
                  onChange={(e) =>
                    setNewBrandId(
                      e.target.value as DbaBrand,
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
                >
                  {brands.map((b) => (
                    <option
                      key={b.id}
                      value={b.id}
                    >
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) =>
                    setNewName(e.target.value)
                  }
                  placeholder="e.g. Crispy Birria Burrito"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-400">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newPrice}
                    onChange={(e) =>
                      setNewPrice(
                        Number(e.target.value),
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-400">
                    KDS Station
                  </label>
                  <select
                    value={newStation}
                    onChange={(e) =>
                      setNewStation(
                        e.target
                          .value as KitchenStation,
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
                  >
                    {STATIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-400">
                    Primary Ingredient
                  </label>
                  <select
                    value={newIngredientId}
                    onChange={(e) =>
                      setNewIngredientId(
                        e.target.value,
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
                  >
                    {inventory.map((inv) => (
                      <option
                        key={inv.id}
                        value={inv.id}
                      >
                        {inv.name} ({inv.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-400">
                    Qty per Order
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={newIngredientQty}
                    onChange={(e) =>
                      setNewIngredientQty(
                        Number(e.target.value),
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-500 py-3 font-mono text-xs font-black uppercase text-slate-950 hover:bg-emerald-400"
              >
                + Add Menu Item to Catalog
              </button>
            </form>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
