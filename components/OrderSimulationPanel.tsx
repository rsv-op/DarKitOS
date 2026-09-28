"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  BRANDS_DB,
  KITCHENS_DB,
  MENU_CATALOG,
  type DbaBrand,
  type Order,
  type OrderChannel,
} from "@/lib/db";

interface OrderSimulationPanelProps {
  onInject?: (
    newOrder: Order
  ) => void;
}

const CHANNELS: OrderChannel[] = [
  "Swiggy",
  "Zomato",
  "DoorDash",
  "UberEats",
  "GrubHub",
  "Direct Web",
];

function createId(
  prefix: string
): string {
  return `${prefix}-${Date.now()}-${Math.floor(
    Math.random() * 10000
  )}`;
}

export default function OrderSimulationPanel({
  onInject,
}: OrderSimulationPanelProps) {
  const [selectedBrand, setSelectedBrand] =
    useState<DbaBrand>(
      "BurgerForge"
    );

  const [selectedChannel, setSelectedChannel] =
    useState<OrderChannel>(
      "Swiggy"
    );

  const [selectedMenuItemId, setSelectedMenuItemId] =
    useState("MENU-BF-01");

  const [quantity, setQuantity] =
    useState(1);

  const [customNotes, setCustomNotes] =
    useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState<
      "success" |
      "warning" |
      "error" |
      ""
    >("");

  /*
   * The current seeded simulator
   * operates from K1. This preserves
   * the existing project's manual
   * testing behavior rather than
   * inventing a new kitchen-routing
   * rule.
   */
  const kitchen =
    KITCHENS_DB[0];

  const availableMenuItems =
    useMemo(
      () =>
        MENU_CATALOG.filter(
          (item) =>
            item.brandId ===
            selectedBrand
        ),
      [selectedBrand]
    );

  const selectedMenuItem =
    useMemo(
      () =>
        MENU_CATALOG.find(
          (item) =>
            item.id ===
            selectedMenuItemId
        ),
      [selectedMenuItemId]
    );

  function handleBrandChange(
    brand: DbaBrand
  ) {
    setSelectedBrand(brand);

    const firstItem =
      MENU_CATALOG.find(
        (item) =>
          item.brandId ===
          brand
      );

    setSelectedMenuItemId(
      firstItem?.id ?? ""
    );
  }

  function handleQuantityChange(
    value: string
  ) {
    const parsed =
      Number.parseInt(
        value,
        10
      );

    if (
      !Number.isFinite(
        parsed
      ) ||
      parsed < 1
    ) {
      setQuantity(1);
      return;
    }

    setQuantity(parsed);
  }

  async function handleSubmit() {
    if (
      !selectedMenuItem ||
      quantity < 1 ||
      isSubmitting
    ) {
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setMessageType("");

    const now =
      new Date().toISOString();

    const newOrder: Order = {
      id: createId("ORD"),

      brandId:
        selectedBrand,

      kitchenId:
        kitchen.id,

      channel:
        selectedChannel,

      source:
        "MANUAL",

      status:
        "PENDING",

      items: [
        {
          id: createId("ITEM"),

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

      createdAt: now,
      updatedAt: now,
      receivedAt: now,

      events: [
        {
          id: createId("EVT"),
          type: "RECEIVED",
          timestamp: now,
          actor: "SYSTEM",
          details:
            "Manual test order received.",
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
              newOrder
            ),
          }
        );

      const data =
        (await response.json()) as {
          order?: Order;
          error?: string;
          inventoryDecision?: string;
          inventoryWarnings?: string[];
          inventoryUnavailable?: string[];
        };

      if (!response.ok) {
        const unavailable =
          Array.isArray(
            data.inventoryUnavailable
          )
            ? data.inventoryUnavailable
            : [];

        setMessage(
          unavailable.length > 0
            ? `Order not accepted: insufficient inventory for ${unavailable.join(", ")}`
            : data.error ??
                "Failed to inject test order."
        );

        setMessageType(
          unavailable.length > 0
            ? "warning"
            : "error"
        );

        return;
      }

      if (!data.order) {
        setMessage(
          "The Orders API returned no stored order."
        );

        setMessageType(
          "error"
        );

        return;
      }

      onInject?.(
        data.order
      );

      if (
        data.inventoryDecision ===
        "LOW_STOCK"
      ) {
        const warningItems =
          Array.isArray(
            data.inventoryWarnings
          )
            ? data.inventoryWarnings
            : [];

        setMessage(
          warningItems.length > 0
            ? `Order accepted with low-stock warning: ${warningItems.join(", ")}`
            : "Order accepted with low-stock warning."
        );

        setMessageType(
          "warning"
        );
      } else {
        setMessage(
          `Order ${data.order.id} accepted successfully.`
        );

        setMessageType(
          "success"
        );
      }

      setQuantity(1);
      setCustomNotes("");
    } catch (error) {
      console.error(
        "Manual order injection failed:",
        error
      );

      setMessage(
        "Unable to reach the Orders API."
      );

      setMessageType(
        "error"
      );
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
              Manual Order Simulator
            </h2>

            <p className="mt-1 text-xs text-neutral-500">
              Development test source ·{" "}
              {kitchen.code}
            </p>
          </div>

          <span className="rounded-full border border-cyan-800/60 bg-cyan-950/30 px-3 py-1 text-[10px] font-mono uppercase text-cyan-300">
            Manual Test Source
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-neutral-400">
            Brand
          </span>

          <select
            value={
              selectedBrand
            }
            onChange={(event) =>
              handleBrandChange(
                event.target
                  .value as DbaBrand
              )
            }
            disabled={
              isSubmitting
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm outline-none disabled:opacity-50"
          >
            {BRANDS_DB.map(
              (brand) => (
                <option
                  key={brand.id}
                  value={brand.id}
                >
                  {brand.name}
                </option>
              )
            )}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-neutral-400">
            Order Channel
          </span>

          <select
            value={
              selectedChannel
            }
            onChange={(event) =>
              setSelectedChannel(
                event.target
                  .value as OrderChannel
              )
            }
            disabled={
              isSubmitting
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm outline-none disabled:opacity-50"
          >
            {CHANNELS.map(
              (channel) => (
                <option
                  key={channel}
                  value={channel}
                >
                  {channel}
                </option>
              )
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
                event.target.value
              )
            }
            disabled={
              isSubmitting ||
              availableMenuItems.length ===
                0
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm outline-none disabled:opacity-50"
          >
            {availableMenuItems.map(
              (item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.name} · ₹
                  {item.price.toFixed(
                    2
                  )}{" "}
                  ·{" "}
                  {item.station}
                </option>
              )
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
            step={1}
            value={quantity}
            onChange={(event) =>
              handleQuantityChange(
                event.target.value
              )
            }
            disabled={
              isSubmitting
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm outline-none disabled:opacity-50"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-neutral-400">
            Kitchen
          </span>

          <input
            value={
              kitchen.name
            }
            disabled
            readOnly
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-3 text-sm text-neutral-500"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs text-neutral-400">
            Kitchen Notes
          </span>

          <textarea
            value={
              customNotes
            }
            onChange={(event) =>
              setCustomNotes(
                event.target.value
              )
            }
            rows={3}
            maxLength={500}
            disabled={
              isSubmitting
            }
            placeholder="Optional preparation notes..."
            className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm outline-none disabled:opacity-50"
          />

          <span className="mt-1 block text-right text-[10px] text-neutral-600">
            {customNotes.length}/500
          </span>
        </label>
      </div>

      {message && (
        <div
          role="status"
          className={`mt-4 rounded-lg border px-3 py-3 text-xs ${
            messageType ===
            "success"
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
        onClick={() =>
          void handleSubmit()
        }
        disabled={
          !selectedMenuItem ||
          isSubmitting ||
          quantity < 1
        }
        className="mt-5 w-full rounded-lg bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting
          ? "Submitting Test Order..."
          : "Inject Test Order"}
      </button>
    </section>
  );
}
