"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  BRANDS_DB,
  BRAND_KITCHENS_DB,
  INVENTORY_DB,
  KITCHENS_DB,
  MENU_CATALOG,
  type BrandKitchenConfig,
  type DbaBrand,
  type InventoryItem,
  type KitchenConfig,
  type MenuItem,
  type Order,
  type OrderChannel,
  type OutboxEvent,
  type WebhookIdempotencyEntry,
} from "@/lib/db";

const CHANNELS: OrderChannel[] = [
  "Swiggy",
  "Zomato",
  "DoorDash",
  "UberEats",
  "GrubHub",
  "Direct Web",
];

const BACKOFF_SCHEDULE = [
  {
    attempt: "Attempt 1",
    delay: "Immediate",
    scenario:
      "Initial execution of the webhook or internal event.",
  },
  {
    attempt: "Attempt 2",
    delay: "+10 seconds",
    scenario:
      "Mitigation of brief network blips or microservice restarts.",
  },
  {
    attempt: "Attempt 3",
    delay: "+1 minute",
    scenario:
      "Mitigation of temporary DNS routing or load balancer reconfigurations.",
  },
  {
    attempt: "Attempt 4",
    delay: "+5 minutes",
    scenario:
      "Recovery from brief database locks or downstream API rate limits.",
  },
  {
    attempt: "Attempt 5",
    delay: "+30 minutes",
    scenario:
      "Recovery from sustained downstream outages or minor deployments.",
  },
  {
    attempt: "Attempt 6",
    delay: "+2 hours",
    scenario:
      "Final automated attempt before transitioning to Dead Letter Queue (DLQ).",
  },
];

export default function OrderSimulationPanel() {
  const [brandKitchens, setBrandKitchens] =
    useState<BrandKitchenConfig[]>(
      BRAND_KITCHENS_DB,
    );
  const [kitchens, setKitchens] = useState<
    KitchenConfig[]
  >(KITCHENS_DB);
  const [menuCatalog, setMenuCatalog] =
    useState<MenuItem[]>(MENU_CATALOG);
  const [inventory, setInventory] = useState<
    InventoryItem[]
  >(INVENTORY_DB);
  const [webhookEvents, setWebhookEvents] =
    useState<WebhookIdempotencyEntry[]>([]);
  const [outboxEvents, setOutboxEvents] =
    useState<OutboxEvent[]>([]);

  const [selectedBrand, setSelectedBrand] =
    useState<DbaBrand>(BRANDS_DB[0].id);
  const [selectedKitchenId, setSelectedKitchenId] =
    useState<string>("K1");
  const [selectedChannel, setSelectedChannel] =
    useState<OrderChannel>("Swiggy");
  const [priority, setPriority] = useState<
    "NORMAL" | "RUSH" | "VIP"
  >("NORMAL");
  const [customerName, setCustomerName] =
    useState("Demo customer");
  const [customNotes, setCustomNotes] =
    useState("");
  const [idempotencyKey, setIdempotencyKey] =
    useState(
      () => `idem-swg-${Date.now().toString().slice(-6)}`,
    );

  // Cart quantities keyed by menuItemId
  const [cart, setCart] = useState<
    Record<string, number>
  >({
    "MENU-BF-01": 1,
  });

  const [message, setMessage] = useState("");
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [messageType, setMessageType] =
    useState<
      "success" | "warning" | "error" | "info"
    >("success");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const loadSystemSnapshot =
    useCallback(async () => {
      try {
        const res = await fetch("/api/system", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.brandKitchens))
          setBrandKitchens(data.brandKitchens);
        if (Array.isArray(data.kitchens))
          setKitchens(data.kitchens);
        if (Array.isArray(data.menuCatalog))
          setMenuCatalog(data.menuCatalog);
        if (Array.isArray(data.inventory))
          setInventory(data.inventory);
        if (Array.isArray(data.webhookEvents))
          setWebhookEvents(data.webhookEvents);
        if (Array.isArray(data.outboxEvents))
          setOutboxEvents(data.outboxEvents);
      } catch {
        // fallback to defaults
      }
    }, []);

  useEffect(() => {
    void loadSystemSnapshot();
  }, [loadSystemSnapshot]);

  // Valid kitchens for selected brand from canonical BrandKitchen matrix
  const authorizedKitchenIds = useMemo(() => {
    return new Set(
      brandKitchens
        .filter(
          (bk) =>
            bk.brandId === selectedBrand &&
            bk.active,
        )
        .map((bk) => bk.kitchenId),
    );
  }, [brandKitchens, selectedBrand]);

  const availableMenuItems = useMemo(
    () =>
      menuCatalog.filter(
        (item) =>
          item.brandId === selectedBrand &&
          item.active !== false,
      ),
    [menuCatalog, selectedBrand],
  );

  function handleBrandChange(brand: DbaBrand) {
    setSelectedBrand(brand);
    const validKitchen = kitchens.find((k) =>
      brandKitchens.some(
        (bk) =>
          bk.brandId === brand &&
          bk.kitchenId === k.id &&
          bk.active &&
          k.active,
      ),
    );
    if (validKitchen) {
      setSelectedKitchenId(validKitchen.id);
    }

    const firstItem = menuCatalog.find(
      (item) => item.brandId === brand,
    );
    setCart(
      firstItem ? { [firstItem.id]: 1 } : {},
    );
    setIdempotencyKey(
      `idem-${brand.slice(0, 2).toLowerCase()}-${Date.now().toString().slice(-6)}`,
    );
  }

  function updateItemQty(
    menuItemId: string,
    delta: number,
  ) {
    setCart((prev) => {
      const current = prev[menuItemId] || 0;
      const next = Math.max(
        0,
        current + delta,
      );
      const copy = { ...prev };
      if (next === 0) {
        delete copy[menuItemId];
      } else {
        copy[menuItemId] = next;
      }
      return copy;
    });
  }

  const cartItems = useMemo(() => {
    return availableMenuItems
      .filter((m) => (cart[m.id] || 0) > 0)
      .map((m) => ({
        menuItem: m,
        quantity: cart[m.id],
      }));
  }, [availableMenuItems, cart]);

  const orderTotal = useMemo(() => {
    return cartItems.reduce(
      (sum, entry) =>
        sum +
        entry.menuItem.price * entry.quantity,
      0,
    );
  }, [cartItems]);

  // Live recipe ingredient requirement preview
  const ingredientPreview = useMemo(() => {
    const reqMap = new Map<string, number>();
    for (const entry of cartItems) {
      for (const ing of entry.menuItem.recipe) {
        const cur =
          reqMap.get(ing.inventoryItemId) || 0;
        reqMap.set(
          ing.inventoryItemId,
          Number(
            (
              cur +
              ing.quantityRequired *
                entry.quantity
            ).toFixed(4),
          ),
        );
      }
    }
    return Array.from(reqMap.entries()).map(
      ([invId, requiredQty]) => {
        const inv = inventory.find(
          (i) => i.id === invId,
        );
        const currentStock =
          inv?.currentStock ?? 0;
        const threshold =
          inv?.reorderThreshold ?? 0;
        const remaining =
          currentStock - requiredQty;
        const status =
          currentStock < requiredQty
            ? "INSUFFICIENT"
            : remaining <= threshold
              ? "LOW_STOCK"
              : "AVAILABLE";
        return {
          id: invId,
          name: inv?.name || invId,
          unit: inv?.unit || "units",
          requiredQty,
          currentStock,
          remaining: Number(
            remaining.toFixed(2),
          ),
          status,
        };
      },
    );
  }, [cartItems, inventory]);

  async function submitOrder(
    reuseKey = false,
  ) {
    if (cartItems.length === 0) {
      setMessage(
        "Choose at least one menu item.",
      );
      setMessageType("error");
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setCreatedOrderId(null);

    const activeKey = reuseKey
      ? idempotencyKey
      : idempotencyKey.trim() ||
        `idem-${Date.now()}`;

    try {
      const response = await fetch(
        "/api/orders",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            brandId: selectedBrand,
            kitchenId: selectedKitchenId,
            channel: selectedChannel,
            priority,
            customerName:
              customerName.trim() ||
              "Demo customer",
            notes:
              customNotes.trim() || undefined,
            idempotencyKey: activeKey,
            items: cartItems.map((entry) => ({
              menuItemId: entry.menuItem.id,
              name: entry.menuItem.name,
              quantity: entry.quantity,
              notes:
                customNotes.trim() || undefined,
            })),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data?.error ||
            "Couldn’t create the sample order. Check your selections and try again.",
        );
        setMessageType("error");
        return;
      }

      const storedOrder =
        data?.order as Order;
      setCreatedOrderId(storedOrder.id);
      await loadSystemSnapshot();

      if (data?.idempotentReplay) {
        setMessage(
          `Order ${storedOrder.id} already exists. No duplicate order was created.`,
        );
        setMessageType("info");
      } else if (
        data?.inventoryDecision ===
        "INSUFFICIENT_STOCK"
      ) {
        setMessage(
          `Order ${storedOrder.id} was created, but the kitchen needs more ${(data.inventoryUnavailable || []).join(", ")} before prep can start.`,
        );
        setMessageType("warning");
        setIdempotencyKey(
          `idem-${selectedChannel.slice(0, 3).toLowerCase()}-${Date.now().toString().slice(-6)}`,
        );
      } else if (
        data?.inventoryDecision === "LOW_STOCK"
      ) {
        setMessage(
          `Order ${storedOrder.id} was created. Stock is running low for: ${(data.inventoryWarnings || []).join(", ")}.`,
        );
        setMessageType("warning");
        setIdempotencyKey(
          `idem-${selectedChannel.slice(0, 3).toLowerCase()}-${Date.now().toString().slice(-6)}`,
        );
      } else {
        setMessage(
          `Order ${storedOrder.id} was created. Find it in Live Orders or on the Kitchen Board.`,
        );
        setMessageType("success");
        setIdempotencyKey(
          `idem-${selectedChannel.slice(0, 3).toLowerCase()}-${Date.now().toString().slice(-6)}`,
        );
      }
    } catch (err) {
      console.error(
        "Order injection failed:",
        err,
      );
      setMessage(
        "Couldn’t save the order. Please try again.",
      );
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        {/* Left: Order Injection & BrandKitchen Cascading Builder */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-slate-100 shadow-xl sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-sky-400">
                Sample data only
              </span>
              <h2 className="mt-1 text-xl font-black text-white">
                Build a sample order
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                A meal is already selected. Keep the defaults to try your first order, or change them to make your own example.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* 1. Virtual Brand */}
            <label className="block">
              <span className="mb-1.5 block font-mono text-xs font-bold uppercase text-slate-300">
                1. Food brand
              </span>
              <select
                value={selectedBrand}
                onChange={(e) =>
                  handleBrandChange(
                    e.target.value as DbaBrand,
                  )
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none focus:border-sky-400"
              >
                {BRANDS_DB.map((brand) => (
                  <option
                    key={brand.id}
                    value={brand.id}
                  >
                    {brand.name} ({brand.code}) —{" "}
                    {brand.cuisine}
                  </option>
                ))}
              </select>
            </label>

            {/* 2. Cascading Physical Kitchen */}
            <label className="block">
              <span className="mb-1.5 block font-mono text-xs font-bold uppercase text-slate-300">
                2. Kitchen location
              </span>
              <select
                value={selectedKitchenId}
                onChange={(e) =>
                  setSelectedKitchenId(
                    e.target.value,
                  )
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none focus:border-sky-400"
              >
                {kitchens.map((k) => {
                  const authorized =
                    authorizedKitchenIds.has(
                      k.id,
                    ) && k.active;
                  return (
                    <option
                      key={k.id}
                      value={k.id}
                    >
                      {authorized ? "✓ " : "✕ "}
                      {k.id} • {k.name}{" "}
                      {authorized
                        ? "(Authorized)"
                        : "(Doesn’t serve this brand)"}
                    </option>
                  );
                })}
              </select>
            </label>

            {/* 3. Order Channel */}
            <label className="block">
              <span className="mb-1.5 block font-mono text-xs font-bold uppercase text-slate-300">
                3. Order source
              </span>
              <select
                value={selectedChannel}
                onChange={(e) =>
                  setSelectedChannel(
                    e.target
                      .value as OrderChannel,
                  )
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none focus:border-sky-400"
              >
                {CHANNELS.map((channel) => (
                  <option
                    key={channel}
                    value={channel}
                  >
                    {channel}
                  </option>
                ))}
              </select>
            </label>

            {/* 4. Priority & Customer */}
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1.5 block font-mono text-xs font-bold uppercase text-slate-300">
                  Priority
                </span>
                <select
                  value={priority}
                  onChange={(e) =>
                    setPriority(
                      e.target.value as
                        | "NORMAL"
                        | "RUSH"
                        | "VIP",
                    )
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-sky-400"
                >
                  <option value="NORMAL">
                    NORMAL
                  </option>
                  <option value="RUSH">
                    RUSH
                  </option>
                  <option value="VIP">
                    VIP
                  </option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block font-mono text-xs font-bold uppercase text-slate-300">
                  Sample customer name
                </span>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) =>
                    setCustomerName(
                      e.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-sky-400"
                />
              </label>
            </div>
          </div>

          {/* 5. Brand-Owned Menu Catalog Selection */}
          <div className="mt-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold uppercase text-slate-300">
                4. Add menu items
              </span>
              <span className="font-mono text-xs text-emerald-400">
                Order Total: ${orderTotal.toFixed(2)}
              </span>
            </div>

            <div className="space-y-2.5">
              {availableMenuItems.map((item) => {
                const qty = cart[item.id] || 0;
                return (
                  <div
                    key={item.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 transition ${
                      qty > 0
                        ? "border-sky-500/50 bg-sky-500/10"
                        : "border-slate-800 bg-slate-950"
                    }`}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-white">
                          {item.name}
                        </span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-sky-300">
                          {item.station}
                        </span>
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          ${item.price.toFixed(2)}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-slate-400">
                        Recipe:{" "}
                        {item.recipe.length === 0
                          ? "Direct station prep (no tracked raw SKU)"
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

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateItemQty(
                            item.id,
                            -1,
                          )
                        }
                        aria-label={`Remove one ${item.name}`}
                        className="h-8 w-8 rounded-lg border border-slate-700 bg-slate-900 font-mono text-sm font-bold text-white hover:bg-slate-800"
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-mono text-sm font-bold text-white">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateItemQty(
                            item.id,
                            1,
                          )
                        }
                        aria-label={`Add one ${item.name}`}
                        className="h-8 w-8 rounded-lg border border-sky-500/40 bg-sky-500/20 font-mono text-sm font-bold text-sky-300 hover:bg-sky-500/30"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <label className="block">
              <span className="mb-1 block font-mono text-xs font-bold uppercase text-slate-300">
                Kitchen notes (optional)
              </span>
              <input
                type="text"
                value={customNotes}
                onChange={(e) =>
                  setCustomNotes(e.target.value)
                }
                placeholder="e.g. Allergy alert, extra sear..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-sky-400"
              />
            </label>
          </div>

          {message && (
            <div
              className={`mt-5 rounded-xl border px-4 py-3 font-mono text-xs ${
                messageType === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : messageType === "warning"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : messageType === "info"
                      ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                      : "border-red-500/40 bg-red-500/10 text-red-300"
              }`}
            >
              <p role={messageType === "error" ? "alert" : "status"}>{message}</p>
              {createdOrderId && (
                <Link
                  href={`/live-orders?order=${encodeURIComponent(createdOrderId)}`}
                  className="mt-2 inline-block rounded font-semibold text-white underline underline-offset-4 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                >
                  Find this order in Live Orders →
                </Link>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                void submitOrder(false)
              }
              disabled={
                cartItems.length === 0 ||
                isSubmitting
              }
              className="flex-1 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 px-5 py-3.5 font-mono text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? "Creating order…"
                : `Create sample order ($${orderTotal.toFixed(2)})`}
            </button>

          </div>

          <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950/55 p-3.5">
            <summary className="cursor-pointer text-sm font-medium text-slate-300">Advanced order options</summary>
            <p className="my-2 text-xs leading-5 text-slate-400">Test how the workspace handles repeat order notifications.</p>
            <label className="block">
              <span className="mb-1 block font-mono text-xs font-bold uppercase text-slate-300">
                Upstream Idempotency Key
              </span>
              <input
                type="text"
                value={idempotencyKey}
                onChange={(e) =>
                  setIdempotencyKey(
                    e.target.value,
                  )
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-xs text-sky-300 outline-none focus:border-sky-400"
              />
            </label>

            {webhookEvents.length > 0 && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  const lastKey =
                    webhookEvents[0]
                      .idempotencyKey;
                  setIdempotencyKey(lastKey);
                  void (async () => {
                    setIsSubmitting(true);
                    try {
                      const res = await fetch(
                        "/api/orders",
                        {
                          method: "POST",
                          headers: {
                            "Content-Type":
                              "application/json",
                          },
                          body: JSON.stringify({
                            brandId:
                              webhookEvents[0]
                                .brandId,
                            kitchenId:
                              webhookEvents[0]
                                .kitchenId,
                            channel:
                              webhookEvents[0]
                                .channel,
                            idempotencyKey:
                              lastKey,
                            items:
                              cartItems.length >
                              0
                                ? cartItems.map(
                                    (c) => ({
                                      menuItemId:
                                        c.menuItem
                                          .id,
                                      quantity:
                                        c.quantity,
                                    }),
                                  )
                                : [
                                    {
                                      menuItemId:
                                        "MENU-BF-01",
                                      quantity: 1,
                                    },
                                  ],
                          }),
                        },
                      );
                      const data =
                        await res.json();
                      await loadSystemSnapshot();
                      if (
                        data?.idempotentReplay
                      ) {
                        setMessage(
                          `Idempotency Guard Verified! Replaying key "${lastKey}" was cleanly blocked via atomic reservation. Cached Order ${data.order.id} returned without duplicate creation.`,
                        );
                        setMessageType("info");
                      }
                    } finally {
                      setIsSubmitting(false);
                    }
                  })();
                }}
                className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3.5 font-mono text-xs font-bold text-amber-300 hover:bg-amber-500/20"
                title="Simulate an upstream aggregator webhook retry with the last idempotency key"
              >
                ↺ Simulate Duplicate Webhook Retry
              </button>
            )}
          </details>
        </section>

        {/* Right: Live Recipe Stock Check & Idempotency / Outbox Diagnostics */}
        <div className="space-y-6">
          {/* Recipe Depletion Preview */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
                Ingredients needed
              </h3>
              <Link
                href="/inventory"
                className="font-mono text-[11px] text-sky-400 hover:underline"
              >
                View Inventory →
              </Link>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              These ingredients are deducted from stock when the kitchen starts preparing the order.
            </p>

            {ingredientPreview.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-950 p-4 text-center text-xs text-slate-500">
                No ingredients are tracked for these items.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {ingredientPreview.map((ing) => (
                  <div
                    key={ing.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-white">
                        {ing.name}
                      </p>
                      <p className="font-mono text-[10px] text-slate-400">
                        Requires: {ing.requiredQty}{" "}
                        {ing.unit} • On Hand:{" "}
                        {ing.currentStock}{" "}
                        {ing.unit}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                        ing.status ===
                        "INSUFFICIENT"
                          ? "bg-red-500/20 text-red-300 border border-red-500/40"
                          : ing.status ===
                              "LOW_STOCK"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      }`}
                    >
                      {ing.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <details className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-300">Order delivery diagnostics</summary>
            <div className="mt-3 space-y-3">
              {/* Two-Phase Atomic Idempotency Ledger */}
              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-sky-400">
                  Atomic Webhook Deduplication Ledger
                </h3>
                <pre className="mt-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-emerald-300">
    {`INSERT INTO webhook_events (idempotency_key, status)
    VALUES ($1, 'processing')
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING idempotency_key;`}
                </pre>

                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                  {webhookEvents
                    .slice(0, 6)
                    .map((w) => (
                      <div
                        key={w.idempotencyKey}
                        className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-[11px]"
                      >
                        <div>
                          <p className="font-bold text-white">
                            {w.idempotencyKey} →{" "}
                            <span className="text-sky-400">
                              {w.orderId}
                            </span>
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {w.payloadSummary}
                          </p>
                        </div>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            w.hitCount > 1
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          Hits: {w.hitCount}
                        </span>
                      </div>
                    ))}
                </div>
              </section>

              {/* Transactional Outbox & Exponential Backoff Schedule */}
              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-purple-400">
                  Transactional Outbox Retry Schedule
                </h3>
                <div className="mt-3 space-y-1.5">
                  {BACKOFF_SCHEDULE.map((b) => (
                    <div
                      key={b.attempt}
                      className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-1.5 text-[11px]"
                    >
                      <span className="font-mono font-bold text-slate-200">
                        {b.attempt} ({b.delay})
                      </span>
                      <span className="text-slate-400 text-right">
                        {b.scenario}
                      </span>
                    </div>
                  ))}
                </div>
                {outboxEvents.length > 0 && (
                  <div className="mt-3 border-t border-slate-800 pt-3">
                    <p className="font-mono text-[10px] uppercase text-slate-400 mb-1.5">
                      Recent Outbox Fan-Out Events
                    </p>
                    {outboxEvents
                      .slice(0, 3)
                      .map((ev) => (
                        <div
                          key={ev.id}
                          className="flex items-center justify-between font-mono text-[10px] text-slate-300 py-1"
                        >
                          <span>
                            {ev.eventType} (
                            {ev.aggregateId})
                          </span>
                          <span className="text-emerald-400">
                            {ev.status}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </section>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
