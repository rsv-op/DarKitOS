"use client";

import { useMemo, useState } from "react";

import {
  BRANDS_DB,
  KITCHENS_DB,
  MENU_CATALOG,
  type DbaBrand,
  type Order,
  type OrderChannel,
} from "@/lib/db";

type Props = {
  onInject?: (order: Order) => void;
};

const CHANNELS: OrderChannel[] = [
  "Swiggy",
  "Zomato",
  "DoorDash",
  "UberEats",
  "GrubHub",
  "Direct Web",
];

const CHANNEL_SOURCE_MAP: Record<
  OrderChannel,
  Order["source"]
> = {
  Swiggy: "SWIGGY",
  Zomato: "ZOMATO",
  DoorDash: "DOORDASH",
  UberEats: "UBEREATS",
  GrubHub: "GRUBHUB",
  "Direct Web": "DIRECT_WEB",
};

export default function OrderSimulationPanel({
  onInject,
}: Props) {
  const kitchen =
    KITCHENS_DB.find(
      (item) => item.id === "K1",
    ) ?? KITCHENS_DB[0];

  const [selectedBrand, setSelectedBrand] =
    useState<DbaBrand>(
      BRANDS_DB[0].id,
    );

  const [selectedChannel, setSelectedChannel] =
    useState<OrderChannel>("Swiggy");

  const [selectedMenuItemId, setSelectedMenuItemId] =
    useState(
      MENU_CATALOG.find(
        (item) =>
          item.brandId === BRANDS_DB[0].id,
      )?.id ?? "",
    );

  const [quantity, setQuantity] =
    useState(1);

  const [customNotes, setCustomNotes] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState<
      "success" | "warning" | "error"
    >("success");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const availableMenuItems =
    useMemo(
      () =>
        MENU_CATALOG.filter(
          (item) =>
            item.brandId ===
            selectedBrand,
        ),
      [selectedBrand],
    );

  const selectedMenuItem =
    MENU_CATALOG.find(
      (item) =>
        item.id ===
        selectedMenuItemId,
    );

  function handleBrandChange(
    brand: DbaBrand,
  ) {
    setSelectedBrand(brand);

    const firstMenuItem =
      MENU_CATALOG.find(
        (item) =>
          item.brandId === brand,
      );

    setSelectedMenuItemId(
      firstMenuItem?.id ?? "",
    );
  }

  async function handleSubmit() {
    if (!selectedMenuItem) {
      setMessage(
        "Select a menu item first.",
      );
      setMessageType("error");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    const now =
      new Date().toISOString();

    const orderId =
      `DEV-${Date.now()}`;

    const eventId =
      `${orderId}-EVENT-001`;

    const newOrder: Order = {
      id: orderId,

      externalOrderId:
        `DEV-EXT-${Date.now()}`,

      brandId: selectedBrand,

      kitchenId: kitchen.id,

      channel: selectedChannel,

      source:
        CHANNEL_SOURCE_MAP[
          selectedChannel
        ],

      status: "PENDING",

      items: [
        {
          id: `${orderId}-ITEM-001`,
          menuItemId:
            selectedMenuItem.id,
          name:
            selectedMenuItem.name,
          quantity,
          notes:
            customNotes.trim() ||
            undefined,
          station:
            selectedMenuItem.station,
        },
      ],

      customerName:
        "Development Test Customer",

      createdAt: now,
      updatedAt: now,
      receivedAt: now,

      events: [
        {
          id: eventId,
          type: "RECEIVED",
          timestamp: now,
          actor: "DEVELOPER",
          details:
            "Manual development test order injected.",
        },
      ],
    };

    try {
      const response =
        await fetch(
          "/api/orders",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              newOrder,
            ),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        const unavailable =
          Array.isArray(
            data?.inventoryUnavailable,
          ) &&
          data.inventoryUnavailable
            .length > 0;

        setMessage(
          unavailable
            ? `Order rejected: insufficient inventory for ${data.inventoryUnavailable.join(", ")}`
            : data?.error ||
                "Failed to inject test order.",
        );

        setMessageType(
          unavailable
            ? "warning"
            : "error",
        );

        return;
      }

      const storedOrder =
        data?.order as Order;

      onInject?.(storedOrder);

      if (
        data?.inventoryDecision ===
        "LOW_STOCK"
      ) {
        setMessage(
          `Order ${storedOrder.id} accepted with a low-stock warning.`,
        );

        setMessageType(
          "warning",
        );
      } else {
        setMessage(
          `Order ${storedOrder.id} accepted successfully.`,
        );

        setMessageType(
          "success",
        );
      }

      setQuantity(1);
      setCustomNotes("");
    } catch (error) {
      console.error(
        "Order injection failed:",
        error,
      );

      setMessage(
        "Unable to reach the Orders API.",
      );

      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 text-neutral-100">

      <div className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider">
              Order Injection
            </h2>

            <p className="mt-1 text-xs text-neutral-500">
              Development source •{" "}
              {kitchen.name}
            </p>
          </div>

          <span className="rounded-full border border-amber-800/60 bg-amber-950/30 px-3 py-1 font-mono text-[10px] uppercase text-amber-300">
            Developer Tool
          </span>

        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

        <label className="block">
          <span className="mb-1 block text-xs text-neutral-400">
            Brand
          </span>

          <select
            value={selectedBrand}
            onChange={(event) =>
              handleBrandChange(
                event.target
                  .value as DbaBrand,
              )
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm outline-none focus:border-sky-500"
          >
            {BRANDS_DB.map(
              (brand) => (
                <option
                  key={brand.id}
                  value={brand.id}
                >
                  {brand.name}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-neutral-400">
            Order Channel
          </span>

          <select
            value={selectedChannel}
            onChange={(event) =>
              setSelectedChannel(
                event.target
                  .value as OrderChannel,
              )
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm outline-none focus:border-sky-500"
          >
            {CHANNELS.map(
              (channel) => (
                <option
                  key={channel}
                  value={channel}
                >
                  {channel}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs text-neutral-400">
            Menu Item
          </span>

          <select
            value={
              selectedMenuItemId
            }
            onChange={(event) =>
              setSelectedMenuItemId(
                event.target.value,
              )
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm outline-none focus:border-sky-500"
          >
            {availableMenuItems.map(
              (item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.name} · $
                  {item.price.toFixed(
                    2,
                  )}{" "}
                  · {item.station}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-neutral-400">
            Quantity
          </span>

          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(event) =>
              setQuantity(
                Math.max(
                  1,
                  Number.parseInt(
                    event.target
                      .value || "1",
                    10,
                  ),
                ),
              )
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm outline-none focus:border-sky-500"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-neutral-400">
            Kitchen
          </span>

          <input
            value={kitchen.name}
            disabled
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-3 text-sm text-neutral-500"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs text-neutral-400">
            Kitchen Notes
          </span>

          <textarea
            value={customNotes}
            onChange={(event) =>
              setCustomNotes(
                event.target.value,
              )
            }
            rows={3}
            placeholder="Optional preparation notes..."
            className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm outline-none focus:border-sky-500"
          />
        </label>

      </div>

      {message && (
        <div
          className={`mt-4 rounded-lg border px-3 py-3 text-xs ${
            messageType === "success"
              ? "border-emerald-800 bg-emerald-950/30 text-emerald-300"
              : messageType ===
                  "warning"
                ? "border-amber-800 bg-amber-950/30 text-amber-300"
                : "border-red-800 bg-red-950/30 text-red-300"
          }`}
        >
          {message}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={
          !selectedMenuItem ||
          isSubmitting
        }
        className="mt-5 w-full rounded-lg bg-sky-500 px-4 py-3 text-sm font-semibold text-gray-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting
          ? "Injecting Order..."
          : "Inject Test Order"}
      </button>

    </section>
  );
}
