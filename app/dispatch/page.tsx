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
  readyAt?: string;
  driverAssignedAt?: string;
  pickedUpAt?: string;
  dispatchedAt?: string;
  driverName?: string;
  courierEtaMins?: number;
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

export default function DispatchPage() {
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
            "Dispatch load failed:",
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

  const readyOrders =
    useMemo(
      () =>
        orders.filter(
          (order) =>
            order.status ===
              "READY_FOR_PICKUP" ||
            order.status ===
              "DRIVER_ASSIGNED" ||
            order.status ===
              "PICKED_UP"
        ),
      [orders]
    );

  const readyForPickup =
    readyOrders.filter(
      (order) =>
        order.status ===
        "READY_FOR_PICKUP"
    );

  const driverAssigned =
    readyOrders.filter(
      (order) =>
        order.status ===
        "DRIVER_ASSIGNED"
    );

  const pickedUp =
    readyOrders.filter(
      (order) =>
        order.status ===
        "PICKED_UP"
    );

  async function updateOrder(
    orderId: string,
    action:
      | "DRIVER_ASSIGNED"
      | "PICKED_UP"
      | "DISPATCHED",
    driverName?: string,
    courierEtaMins?: number
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
              ...(driverName
                ? {
                    driverName,
                  }
                : {}),
              ...(typeof courierEtaMins ===
              "number"
                ? {
                    courierEtaMins,
                  }
                : {}),
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
        "Dispatch order update failed:",
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

  function assignDriver(
    order: Order
  ) {
    const driverName =
      window.prompt(
        "Driver name"
      );

    if (!driverName?.trim()) {
      return;
    }

    const etaInput =
      window.prompt(
        "Courier ETA in minutes",
        "15"
      );

    if (
      etaInput === null
    ) {
      return;
    }

    const courierEtaMins =
      Number(
        etaInput
      );

    if (
      !Number.isFinite(
        courierEtaMins
      ) ||
      courierEtaMins < 0
    ) {
      setError(
        "Courier ETA must be a non-negative number."
      );
      return;
    }

    void updateOrder(
      order.id,
      "DRIVER_ASSIGNED",
      driverName.trim(),
      courierEtaMins
    );
  }

  function renderOrderCard(
    order: Order
  ) {
    const isUpdating =
      updatingOrderId ===
      order.id;

    return (
      <article
        key={order.id}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-black text-slate-900">
              {order.id}
            </p>

            <p className="text-sm text-slate-500">
              {order.brandId}
            </p>

            <p className="text-xs text-slate-400">
              Kitchen:{" "}
              {order.kitchenId}
            </p>
          </div>

          <div className="text-right text-xs text-slate-500">
            <p>
              Ready{" "}
              {formatTime(
                order.readyAt
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

        {order.status ===
          "READY_FOR_PICKUP" && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() =>
              assignDriver(
                order
              )
            }
            className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-4 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isUpdating
              ? "Assigning..."
              : "ASSIGN DRIVER"}
          </button>
        )}

        {order.status ===
          "DRIVER_ASSIGNED" && (
          <>
            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Driver
              </p>

              <p className="mt-1 font-bold text-slate-900">
                {order.driverName ??
                  "--"}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                ETA:{" "}
                {typeof order.courierEtaMins ===
                "number"
                  ? `${order.courierEtaMins} min`
                  : "--"}
              </p>
            </div>

            <button
              type="button"
              disabled={isUpdating}
              onClick={() =>
                void updateOrder(
                  order.id,
                  "PICKED_UP"
                )
              }
              className="mt-4 w-full rounded-xl bg-amber-500 px-4 py-4 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isUpdating
                ? "Updating..."
                : "MARK PICKED UP"}
            </button>
          </>
        )}

        {order.status ===
          "PICKED_UP" && (
          <>
            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-semibold">
                Order picked up
              </p>

              <p className="mt-1">
                Driver:{" "}
                {order.driverName ??
                  "--"}
              </p>
            </div>

            <button
              type="button"
              disabled={isUpdating}
              onClick={() =>
                void updateOrder(
                  order.id,
                  "DISPATCHED"
                )
              }
              className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-4 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isUpdating
                ? "Updating..."
                : "MARK DISPATCHED"}
            </button>
          </>
        )}
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
                Delivery Operations
              </p>

              <h1 className="text-2xl font-black text-slate-900">
                Dispatch
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
              Ready
            </p>

            <p className="mt-1 text-2xl font-black text-slate-900">
              {readyForPickup.length}
            </p>
          </div>

          <div className="rounded-xl bg-white p-3 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Driver Assigned
            </p>

            <p className="mt-1 text-2xl font-black text-slate-900">
              {driverAssigned.length}
            </p>
          </div>

          <div className="rounded-xl bg-white p-3 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Picked Up
            </p>

            <p className="mt-1 text-2xl font-black text-slate-900">
              {pickedUp.length}
            </p>
          </div>
        </section>

        {loading && (
          <div className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">
            Loading dispatch orders...
          </div>
        )}

        {!loading &&
          readyOrders.length === 0 && (
            <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
              <p className="text-lg font-bold text-slate-900">
                No dispatch orders
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Orders marked ready by the kitchen will appear here.
              </p>
            </div>
          )}

        {!loading &&
          readyOrders.length > 0 && (
            <div className="grid gap-5 lg:grid-cols-3">
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-black text-slate-900">
                    Ready for Pickup
                  </h2>

                  <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                    {readyForPickup.length}
                  </span>
                </div>

                <div className="space-y-4">
                  {readyForPickup.map(
                    renderOrderCard
                  )}
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-black text-slate-900">
                    Driver Assigned
                  </h2>

                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                    {driverAssigned.length}
                  </span>
                </div>

                <div className="space-y-4">
                  {driverAssigned.map(
                    renderOrderCard
                  )}
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-black text-slate-900">
                    Picked Up
                  </h2>

                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    {pickedUp.length}
                  </span>
                </div>

                <div className="space-y-4">
                  {pickedUp.map(
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
