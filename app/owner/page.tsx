"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { INITIAL_INVENTORY, MENU_CATALOG } from "@/lib/db";

// Brand and Status Types
type Brand = "BurgerForge" | "TacoMatrix" | "WingProtocol" | "GreenBowl";
type OrderStatus = "PENDING" | "PREPARING" | "READY" | "DISPATCHED";

interface OrderItem {
  name: string;
  qty: number;
  notes?: string;
}

interface Order {
  id: string;
  brand: Brand;
  channel: "DoorDash" | "UberEats" | "GrubHub" | "Direct Web";
  items: OrderItem[];
  status: OrderStatus;
  elapsedMins: number;
}

const BRAND_COLORS: Record<Brand, string> = {
  BurgerForge: "#f97316", // Orange
  TacoMatrix: "#eab308",  // Yellow
  WingProtocol: "#ef4444",// Red
  GreenBowl: "#10b981",   // Emerald
};

const BRAND_PRICING: Record<string, number> = {
  "Double Smash Burger": 14.5,
  "Truffle Fries": 6.0,
  "Birria Taco Trio": 15.0,
  "12pc Ghost Pepper Wings": 16.5,
  "Ahi Tuna Poke Bowl": 17.0,
};

export default function OwnerAnalysisPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState(INITIAL_INVENTORY);
  const [timeRange, setTimeRange] = useState<"shift" | "today">("today");

  // Fetch real-time orders from API
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Failed to sync live orders:", err);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  // Aggregate Metrics
  const analytics = useMemo(() => {
    let grossRevenue = 0;
    const brandCounts: Record<Brand, number> = {
      BurgerForge: 0,
      TacoMatrix: 0,
      WingProtocol: 0,
      GreenBowl: 0,
    };
    const channelCounts: Record<string, number> = {
      DoorDash: 0,
      UberEats: 0,
      GrubHub: 0,
      "Direct Web": 0,
    };
    let totalPrepMins = 0;
    let completedOrders = 0;

    orders.forEach((o) => {
      // Channel Breakdown
      if (channelCounts[o.channel] !== undefined) {
        channelCounts[o.channel]++;
      }

      // Brand Breakdown & Revenue
      if (brandCounts[o.brand] !== undefined) {
        brandCounts[o.brand]++;
      }

      o.items.forEach((item) => {
        const unitPrice = BRAND_PRICING[item.name] || 12.0;
        grossRevenue += unitPrice * item.qty;
      });

      if (o.status === "READY" || o.status === "DISPATCHED") {
        totalPrepMins += o.elapsedMins;
        completedOrders++;
      }
    });

    const avgVelocity = completedOrders > 0 ? (totalPrepMins / completedOrders).toFixed(1) : "0.0";

    return {
      grossRevenue,
      brandCounts,
      channelCounts,
      avgVelocity,
      totalOrders: orders.length,
      activeTickets: orders.filter((o) => o.status === "PENDING" || o.status === "PREPARING").length,
    };
  }, [orders]);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6 font-sans">
      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between border-b border-neutral-800 pb-5 mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight">Owner Command Center & Analytics</h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Dark-Cloud Kitchen OS · Facility Multi-Brand Telemetry
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/cook"
            className="text-xs px-3 py-2 rounded border border-neutral-700 hover:bg-neutral-800 transition"
          >
            Cook KDS
          </Link>
          <Link
            href="/dispatch"
            className="text-xs px-3 py-2 rounded border border-neutral-700 hover:bg-neutral-800 transition"
          >
            Dispatch Pipeline
          </Link>
          <button
            onClick={() => setTimeRange(timeRange === "today" ? "shift" : "today")}
            className="text-xs px-3 py-2 rounded bg-neutral-800 border border-neutral-700 hover:border-neutral-500 transition font-mono uppercase"
          >
            View: {timeRange}
          </button>
        </div>
      </header>

      {/* KPI Cards Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-neutral-900/70 border border-neutral-800 p-5 rounded-lg">
          <span className="text-xs font-mono uppercase text-neutral-400 tracking-wider">Gross Sales</span>
          <div className="text-3xl font-extrabold mt-2 text-emerald-400 font-mono">
            ${analytics.grossRevenue.toFixed(2)}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">+14.2% vs previous window</p>
        </div>

        <div className="bg-neutral-900/70 border border-neutral-800 p-5 rounded-lg">
          <span className="text-xs font-mono uppercase text-neutral-400 tracking-wider">Active Pipeline</span>
          <div className="text-3xl font-extrabold mt-2 text-white font-mono">
            {analytics.activeTickets} <span className="text-sm font-normal text-neutral-400">/ {analytics.totalOrders} total</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">Pending kitchen assembly</p>
        </div>

        <div className="bg-neutral-900/70 border border-neutral-800 p-5 rounded-lg">
          <span className="text-xs font-mono uppercase text-neutral-400 tracking-wider">Avg Prep Speed</span>
          <div className="text-3xl font-extrabold mt-2 text-cyan-400 font-mono">
            {analytics.avgVelocity} <span className="text-sm font-normal text-neutral-400">min</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">Ticket generation to staging</p>
        </div>

        <div className="bg-neutral-900/70 border border-neutral-800 p-5 rounded-lg">
          <span className="text-xs font-mono uppercase text-neutral-400 tracking-wider">Depletion Alerts</span>
          <div className="text-3xl font-extrabold mt-2 text-rose-400 font-mono">
            {Object.values(inventory).filter((i) => i.stock <= i.threshold).length}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">Ingredients below minimum par</p>
        </div>
      </section>

      {/* Analytics Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Brand Distribution Panel */}
        <section className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-300 mb-4">
            Brand Volume Distribution
          </h2>
          <div className="space-y-4">
            {(Object.keys(analytics.brandCounts) as Brand[]).map((brand) => {
              const count = analytics.brandCounts[brand];
              const pct = analytics.totalOrders > 0 ? (count / analytics.totalOrders) * 100 : 0;
              return (
                <div key={brand}>
                  <div className="flex justify-between text-xs mb-1 font-mono">
                    <span style={{ color: BRAND_COLORS[brand] }}>{brand}</span>
                    <span className="text-neutral-400">{count} pkgs ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: BRAND_COLORS[brand],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Aggregator Channel Matrix */}
        <section className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-300 mb-4">
            Courier Channel Volume
          </h2>
          <div className="space-y-3">
            {Object.entries(analytics.channelCounts).map(([channel, count]) => (
              <div
                key={channel}
                className="flex items-center justify-between p-3 rounded bg-neutral-950 border border-neutral-800 text-xs"
              >
                <span className="font-medium text-neutral-200">{channel}</span>
                <span className="font-mono bg-neutral-800 px-2 py-0.5 rounded text-neutral-300">
                  {count} orders
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Raw Ingredient Depletion Monitor */}
        <section className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-300 mb-4">
            Shared Depletion Watch
          </h2>
          <div className="space-y-3">
            {Object.values(inventory).map((item) => {
              const isLow = item.stock <= item.threshold;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded border text-xs ${
                    isLow
                      ? "bg-rose-950/20 border-rose-800/60 text-rose-200"
                      : "bg-neutral-950 border-neutral-800 text-neutral-300"
                  }`}
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-[10px] text-neutral-500 font-mono">
                      Threshold: {item.threshold} {item.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-sm">
                      {item.stock} {item.unit}
                    </span>
                    {isLow && (
                      <span className="block text-[10px] uppercase font-bold text-rose-400">
                        Restock Required
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
