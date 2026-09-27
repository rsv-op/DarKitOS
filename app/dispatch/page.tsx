"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Order } from "@/lib/db";

const POLL_INTERVAL_MS = 3000;

export default function DispatchDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [driverInputs, setDriverInputs] = useState<
    Record<string, string>
  >({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/orders", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load dispatch orders");
      }

      const data = await response.json();

      if (!data.success || !Array.isArray(data.orders)) {
        throw new Error("Invalid Orders API response");
      }

      setOrders(data.orders);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dispatch orders",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();

    const interval = window.setInterval(() => {
      void loadOrders();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadOrders]);

  const preparingOrders = useMemo(
    () =>
      orders.filter(
        (order) => order.status === "PREPARING",
      ),
    [orders],
  );

  const readyOrders = useMemo(
    () =>
      orders.filter(
        (order) => order.status === "READY_FOR_PICKUP",
      ),
    [orders],
  );

  const dispatchedOrders = useMemo(
    () =>
      orders.filter(
        (order) => order.status === "DISPATCHED",
      ),
    [orders],
  );

  const handleDriverChange = (
    orderId: string,
    value: string,
  ) => {
    setDriverInputs((previous) => ({
      ...previous,
      [orderId]: value,
    }));
  };

  const dispatchOrder = async (order: Order) => {
    if (busyOrderId) {
      return;
    }

    const driverName =
      driverInputs[order.id]?.trim() ||
      order.driverName?.trim();

    if (!driverName) {
      setError(
        `Enter a driver name before dispatching ${order.id}.`,
      );
      setMessage("");
      return;
    }

    setBusyOrderId(order.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: order.id,
          status: "DISPATCHED",
          driverName,
          actor: "DISPATCH",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to dispatch order",
        );
      }

      if (Array.isArray(data.orders)) {
        setOrders(data.orders);
      } else {
        await loadOrders();
      }

      setMessage(
        `${order.id} dispatched with driver ${driverName}.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to dispatch order",
      );
    } finally {
      setBusyOrderId(null);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/95 px-4 py-4 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-emerald-400" />

              <h1 className="text-lg font-bold tracking-tight md:text-xl">
                Dispatch
              </h1>
            </div>

            <p className="mt-1 text-xs text-neutral-500">
              Kitchen K1 · Handoff & dispatch control
            </p>
          </div>

          <div className="flex gap-2">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                Preparing
              </div>

              <div className="text-lg font-bold text-sky-300">
                {preparingOrders.length}
              </div>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                Ready
              </div>

              <div className="text-lg font-bold text-emerald-300">
                {readyOrders.length}
              </div>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto max-w-7xl px-4 pt-4 md:px-6">
          <div className="rounded-lg border border-red-800 bg-red-950/30 px-
