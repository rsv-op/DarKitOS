"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type OrderStatus =
  | "PENDING"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "DRIVER_ASSIGNED"
  | "PICKED_UP"
  | "DISPATCHED"
  | "CANCELLED";

type OrderItem = {
  id?: string;
  menuItemId?: string;
  name?: string;
  quantity?: number;
};

type Order = {
  id: string;
  brandId: string;
  kitchenId: string;
  status: OrderStatus;
  items: OrderItem[];
  createdAt?: string;
  receivedAt?: string;
  prepStartedAt?: string;
  prepCompletedAt?: string;
  readyAt?: string;
  inventoryWarnings?: string[];
  inventoryUnavailable?: string[];
};

type OrdersResponse = {
  orders?: Order[];
  error?: string;
};

type ActionResponse = {
  order?: Order;
  error?: string;
};

function formatTime(
  value?: string
): string {
  if (!value) {
    return "--";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "--";
  }

  return date.toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function getOrderAge(
  value?: string
): string {
  if (!value) {
    return "--";
  }

  const created =
    new Date(value).getTime();

  if (
    Number.isNaN(created)
  ) {
    return "--";
  }

  const minutes = Math.max(
    0,
    Math.floor(
      (Date.now() - created) /
        60000
    )
  );

  return `${minutes} min`;
}

export default function CookPage() {
  const [orders, setOrders] =
    useState<Order[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [updatingOrderId, setUpdatingOrderId] =
    useState<string | null>(null);

  const loadOrders =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              "/api/orders",
              {
                cache: "no-store",
              }
            );

          const data =
            (await response.json()) as OrdersResponse;

          if (!response.ok) {
            throw new Error(
              data.error ??
                "Unable to load orders."
            );
          }

          setOrders(
            Array.isArray(
              data.orders
            )
              ? data.orders
              : []
          );

          setError("");
        } catch (loadError) {
          console.error(
            "Cook KDS load failed:",
            loadError
          );

          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load orders."
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    void loadOrders();

    const interval =
      window.setInterval(
        () => {
          void loadOrders();
        },
        5000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, [loadOrders]);

  const activeOrders =
    useMemo(
      () =>
        orders.filter(
          (order) =>
            order.status ===
              "PENDING" ||
            order.status ===
              "PREPARING" ||
            order.status ===
              "READY_FOR_PICKUP"
        ),
      [orders]
    );

  const pendingOrders =
    activeOrders.filter(
      (order) =>
        order.status ===
        "PENDING"
    );

  const preparingOrders =
    activeOrders.filter(
      (order) =>
        order.status ===
        "PREPARING"
    );

  const readyOrders =
    activeOrders.filter(
      (order) =>
        order.status ===
        "READY_FOR_PICKUP"
    );

  async function updateOrder(
    orderId: string,
    action:
      | "PREPARING"
      | "READY_FOR_PICKUP"
  ) {
    setUpdatingOrderId(
      orderId
    );
    setError("");

    try {
      const response =
        await fetch(
          "/api/orders",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              orderId,
              action,
            }),
          }
        );

      const data =
        (await response.json()) as ActionResponse;

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to update order."
        );
      }

      await loadOrders();
    } catch (updateError) {
      console.error(
        "Cook order update failed:",
        updateError
      );

      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update order."
      );
    } finally {
      setUpdatingOrderId(
        null
      );
    }
  }

  function renderOrderCard(
    order: Order
  ) {
    const isUpdating =
      updatingOrderId ===
      order.id;

    const hasWarnings =
      Boolean(
        order.inventoryWarnings
          ?.length
      );

    const isUnavailable =
      Boolean(
        order.inventoryUnavailable
          ?.length
      );

    return (
      <article
        key={order.id}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-slate-900">
              {order.id}
            </p>

            <p className="text-sm text-slate-500">
              {order.brandId}
            </p>
          </div>

          <div className="text-right text-xs text-slate-500">
            <p>
              Received{" "}
              {formatTime(
                order.receivedAt ??
                  order.createdAt
              )}
            </p>

            <p>
              Age{" "}
              {getOrderAge(
                order.receivedAt ??
                  order.createdAt
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {order.items.map(
            (item, index) => (
              <div
                key={
                  item.id ??
                  item.menuItemId ??
                  `${order.id}-${index}`
                }
                className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
              >
                <span className="font-medium text-slate-800">
                  {item.name ??
                    item.menuItemId ??
                    "Menu item"}
                </span>

                <span className="text-sm font-bold text-slate-600">
                  ×
                  {item.quantity ??
                    1}
                </span>
              </div>
            )
          )}
        </div>

        {hasWarnings && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="font-semibold">
              Inventory / Stock low
            </p>

            <ul className="mt-1 list-disc pl-5">
              {order.inventoryWarnings?.map(
                (warning) => (
                  <li key={warning}>
                    {warning}
                  </li>
                )
              )}
            </ul>
          </div>
        )}

        {isUnavailable && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-semibold">
              Inventory unavailable
            </p>

            <ul className="mt-1 list-disc pl-5">
              {order.inventoryUnavailable?.map(
                (item) => (
                  <li key={item}>
                    {item}
                  </li>
                )
              )}
            </ul>
          </div>
        )}

        <div className="mt-4">
          {order.status ===
            "PENDING" && (
            <button
              type="button"
              disabled={
                isUpdating ||
                isUnavailable
              }
              onClick={() =>
                void updateOrder(
                  order.id,
                  "PREPARING"
                )
              }
              className="w-full rounded-xl bg-slate-900 px-4 py-4 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isUpdating
                ? "Updating..."
                : isUnavailable
                  ? "Inventory Unavailable"
                  : "START PREPARING"}
            </button>
          )}

          {order.status ===
            "PREPARING" && (
            <button
              type="button"
              disabled={
                isUpdating
              }
              onClick={() =>
                void updateOrder(
                  order.id,
                  "READY_FOR_PICKUP"
                )
              }
              className="w-full rounded-xl bg-emerald-600 px-4 py-4 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isUpdating
                ? "Updating..."
                : "MARK READY"}
            </button>
          )}

          {order.status ===
            "READY_FOR_PICKUP" && (
            <div className="rounded-xl bg-emerald-50 px-4 py-4 text-center font-bold text-emerald-700">
              READY FOR PICKUP
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Kitchen Operations
              </p>

              <h1 className="text-2xl font-black text-slate-900">
                Cook KDS
              </h1>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadOrders()
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            >
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <section className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Pending
            </p>
            <p className="mt-1 text-2xl font-black text-slate-900">
              {pendingOrders.length}
            </p>
          </div>

          <div className="rounded-xl bg-white p-3 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Preparing
            </p>
            <p className="mt-1 text-2xl font-black text-slate-900">
              {preparingOrders.length}
            </p>
          </div>

          <div className="rounded-xl bg-white p-3 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Ready
            </p>
            <p className="mt-1 text-2xl font-black text-slate-900">
              {readyOrders.length}
            </p>
          </div>
        </section>

        {loading && (
          <div className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">
            Loading kitchen orders...
          </div>
        )}

        {!loading &&
          activeOrders.length === 0 && (
            <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
              <p className="text-lg font-bold text-slate-900">
                No active orders
              </p>

              <p className="mt-1 text-sm text-slate-500">
                New orders will appear here automatically.
              </p>
            </div>
          )}

        {!loading &&
          activeOrders.length > 0 && (
            <div className="grid gap-5 lg:grid-cols-3">
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-black text-slate-900">
                    New
                  </h2>

                  <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                    {pendingOrders.length}
                  </span>
                </div>

                <div className="space-y-4">
                  {pendingOrders.map(
                    renderOrderCard
                  )}
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-black text-slate-900">
                    Preparing
                  </h2>

                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                    {preparingOrders.length}
                  </span>
                </div>

                <div className="space-y-4">
                  {preparingOrders.map(
                    renderOrderCard
                  )}
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-black text-slate-900">
                    Ready
                  </h2>

                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    {readyOrders.length}
                  </span>
                </div>

                <div className="space-y-4">
                  {readyOrders.map(
                    renderOrderCard
                  )}
                </div>
              </section>
            </div>
          )}
      </div>
    </main>
  );
}
