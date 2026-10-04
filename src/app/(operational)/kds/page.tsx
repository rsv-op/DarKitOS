"use client";

import useSWR from "swr";
import { useState } from "react";

const fetcher = (url: string) =>
  fetch(url).then((res) =>
    res.json()
  );

export default function KDSStation() {
  // Poll canonical API every 3 seconds for new tickets
  const { data: orders, mutate } =
    useSWR(
      "/api/orders?limit=50",
      fetcher,
      { refreshInterval: 3000 }
    );
  const [isTransitioning, setIsTransitioning] =
    useState<string | null>(null);

  const pendingOrders =
    orders?.filter(
      (o: any) => o.status === "PENDING"
    ) || [];
  const preparingOrders =
    orders?.filter(
      (o: any) =>
        o.status === "PREPARING"
    ) || [];

  const updateStatus = async (
    orderId: string,
    newStatus: string
  ) => {
    setIsTransitioning(orderId);
    try {
      // The backend API handles the atomic DB transaction, inventory depletion, and event log
      await fetch(
        `/api/orders/${orderId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            status: newStatus,
          }),
        }
      );
      mutate(); // Optimistic re-fetch
    } catch (error) {
      alert(
        "Transition failed. Check connection."
      );
    } finally {
      setIsTransitioning(null);
    }
  };

  return (
    <div className="h-full w-full p-6 grid grid-cols-2 gap-6 overflow-hidden">
      {/* PENDING QUEUE */}
      <div className="flex flex-col h-full bg-[#111827] rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 bg-[#1E293B] border-b border-slate-800 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-amber-500">
            PENDING QUEUE
          </h2>
          <span className="px-3 py-1 bg-slate-900 rounded-full text-xs font-mono">
            {pendingOrders.length} TICKETS
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {pendingOrders.map(
            (order: any) => (
              <div
                key={order.id}
                className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-lg flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold font-mono text-slate-100">
                      {order.id}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {order.channel} •{" "}
                      {
                        order.itemCount
                      }{" "}
                      items
                    </p>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(
                      order.createdAt
                    ).toLocaleTimeString()}
                  </span>
                </div>
                <button
                  onClick={() =>
                    updateStatus(
                      order.id,
                      "PREPARING"
                    )
                  }
                  disabled={
                    isTransitioning ===
                    order.id
                  }
                  className="mt-auto w-full h-[56px] bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold rounded-lg uppercase tracking-widest transition-colors"
                >
                  {isTransitioning ===
                  order.id
                    ? "SYNCING..."
                    : "START PREPARING"}
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* PREPARING QUEUE */}
      <div className="flex flex-col h-full bg-[#111827] rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 bg-[#1E293B] border-b border-slate-800 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-sky-400">
            ON STATION
          </h2>
          <span className="px-3 py-1 bg-slate-900 rounded-full text-xs font-mono">
            {preparingOrders.length}{" "}
            TICKETS
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {preparingOrders.map(
            (order: any) => (
              <div
                key={order.id}
                className="bg-slate-800 rounded-xl p-5 border border-sky-900/50 shadow-lg flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold font-mono text-slate-100">
                      {order.id}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {order.channel}
                    </p>
                  </div>
                  <div className="px-2 py-1 bg-sky-900/50 text-sky-400 text-xs rounded animate-pulse">
                    PREPPING
                  </div>
                </div>
                <button
                  onClick={() =>
                    updateStatus(
                      order.id,
                      "READY_FOR_PICKUP"
                    )
                  }
                  disabled={
                    isTransitioning ===
                    order.id
                  }
                  className="mt-auto w-full h-[56px] bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-lg uppercase tracking-widest transition-colors"
                >
                  {isTransitioning ===
                  order.id
                    ? "SYNCING..."
                    : "MARK READY"}
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
