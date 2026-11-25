"use client";

import React, { useState } from "react";
import Link from "next/link";
import type {
  InventoryItem,
  Order,
  VirtualFileAsset,
} from "@/lib/db";

interface OSWindow {
  id: string;
  title: string;
  route: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
}

const DEFAULT_WINDOWS: OSWindow[] = [
  {
    id: "win-kds",
    title: "Cook KDS • Ticket Board (/kds)",
    route: "/kds",
    icon: "🔥",
    x: 24,
    y: 20,
    width: 460,
    height: 340,
    zIndex: 10,
    minimized: false,
    maximized: false,
  },
  {
    id: "win-dispatch",
    title: "Dispatch Handoff (/dispatch)",
    route: "/dispatch",
    icon: "✦",
    x: 504,
    y: 20,
    width: 450,
    height: 340,
    zIndex: 11,
    minimized: false,
    maximized: false,
  },
  {
    id: "win-inventory",
    title: "Stock Control Ledger (/inventory)",
    route: "/inventory",
    icon: "▣",
    x: 24,
    y: 380,
    width: 460,
    height: 290,
    zIndex: 12,
    minimized: false,
    maximized: false,
  },
  {
    id: "win-explorer",
    title: "Virtual File Explorer (/explorer)",
    route: "/explorer",
    icon: "▤",
    x: 504,
    y: 380,
    width: 450,
    height: 290,
    zIndex: 13,
    minimized: false,
    maximized: false,
  },
];

// Self-repairing coordinate sanitizer per ADR specification
function sanitizeWindow(
  win: OSWindow,
  index: number,
): OSWindow {
  const safeX =
    Number.isFinite(win.x) &&
    win.x >= 0 &&
    win.x <= 900
      ? win.x
      : (index % 2) * 480 + 24;
  const safeY =
    Number.isFinite(win.y) &&
    win.y >= 0 &&
    win.y <= 520
      ? win.y
      : Math.floor(index / 2) * 350 + 20;
  const safeZ =
    Number.isFinite(win.zIndex) && win.zIndex > 0
      ? win.zIndex
      : 10 + index;

  return {
    ...win,
    x: safeX,
    y: safeY,
    zIndex: safeZ,
  };
}

export default function DesktopWindowManager({
  orders,
  inventory,
  files,
  onQuickTransition,
}: {
  orders: Order[];
  inventory: InventoryItem[];
  files: VirtualFileAsset[];
  onQuickTransition?: (
    orderId: string,
    status: Order["status"],
  ) => Promise<void>;
}) {
  const [windows, setWindows] = useState<
    OSWindow[]
  >(DEFAULT_WINDOWS);
  const [startMenuOpen, setStartMenuOpen] =
    useState(false);
  const [draggingId, setDraggingId] = useState<
    string | null
  >(null);
  const [dragOffset, setDragOffset] = useState({
    x: 0,
    y: 0,
  });
  const [repairLog, setRepairLog] =
    useState<string>("");

  function focusWindow(id: string) {
    setWindows((prev) => {
      const maxZ = prev.reduce(
        (m, w) => Math.max(m, w.zIndex || 10),
        10,
      );
      return prev.map((w, idx) =>
        sanitizeWindow(
          w.id === id
            ? {
                ...w,
                zIndex: maxZ + 1,
                minimized: false,
              }
            : w,
          idx,
        ),
      );
    });
  }

  function toggleMinimize(id: string) {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, minimized: !w.minimized }
          : w,
      ),
    );
  }

  function toggleMaximize(id: string) {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id
          ? {
              ...w,
              maximized: !w.maximized,
              minimized: false,
            }
          : w,
      ),
    );
  }

  function snapAndRepairAll() {
    setWindows((prev) =>
      prev.map((w, idx) => ({
        ...w,
        x: (idx % 2) * 480 + 24,
        y: Math.floor(idx / 2) * 350 + 20,
        zIndex: 10 + idx,
        minimized: false,
        maximized: false,
      })),
    );
    setRepairLog(
      `Self-repairing Window Manager snapped ${windows.length} windows into canonical grid bounds at ${new Date().toLocaleTimeString()}.`,
    );
  }

  function simulateCorruptAndRepair() {
    // Demonstrates the ADR self-healing fallback when NaN coordinates occur
    setWindows((prev) =>
      prev.map((w, idx) =>
        sanitizeWindow(
          {
            ...w,
            x: Number.NaN,
            y: Number.NaN,
            zIndex: Number.NaN,
            minimized: false,
            maximized: false,
          },
          idx,
        ),
      ),
    );
    setRepairLog(
      "Detected NaN window coordinates/z-index → Self-healing fallback restored safe bounds automatically.",
    );
  }

  function handleMouseDown(
    e: React.MouseEvent,
    win: OSWindow,
  ) {
    if (win.maximized) return;
    focusWindow(win.id);
    setDraggingId(win.id);
    setDragOffset({
      x: e.clientX - win.x,
      y: e.clientY - win.y,
    });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!draggingId) return;
    const nextX = e.clientX - dragOffset.x;
    const nextY = e.clientY - dragOffset.y;
    setWindows((prev) =>
      prev.map((w, idx) =>
        w.id === draggingId
          ? sanitizeWindow(
              {
                ...w,
                x: Math.max(
                  8,
                  Math.min(720, nextX),
                ),
                y: Math.max(
                  8,
                  Math.min(460, nextY),
                ),
              },
              idx,
            )
          : w,
      ),
    );
  }

  function handleMouseUp() {
    setDraggingId(null);
  }

  const kdsOrders = orders.filter(
    (o) =>
      o.status === "PENDING" ||
      o.status === "PREPARING",
  );
  const dispatchOrders = orders.filter(
    (o) =>
      o.status === "READY_FOR_PICKUP" ||
      o.status === "DRIVER_ASSIGNED" ||
      o.status === "PICKED_UP",
  );

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#050811] shadow-2xl overflow-hidden">
      {/* Window Manager Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/90 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-sky-400">
            DarKIT OS • Multi-Tasking Window Manager
          </span>
          <span className="hidden sm:inline-block text-xs text-slate-400">
            Drag title bars, minimize/maximize, or snap windows.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={snapAndRepairAll}
            className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1 font-mono text-xs font-semibold text-sky-300 hover:bg-sky-500/20"
          >
            ⊞ Tile & Snap Grid
          </button>
          <button
            type="button"
            onClick={simulateCorruptAndRepair}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-mono text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
            title="Test self-repairing NaN coordinate fallback described in the ADR"
          >
            ⚡ Test Self-Healing Fallback
          </button>
        </div>
      </div>

      {repairLog && (
        <div className="border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2 font-mono text-xs text-emerald-300 flex items-center justify-between">
          <span>✓ {repairLog}</span>
          <button
            type="button"
            onClick={() => setRepairLog("")}
            className="text-emerald-200 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Desktop Canvas */}
      <div
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative h-[700px] w-full overflow-x-auto overflow-y-hidden bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] select-none"
      >
        {windows.map((win) => {
          if (win.minimized) return null;

          const style: React.CSSProperties =
            win.maximized
              ? {
                  left: 12,
                  top: 12,
                  right: 12,
                  bottom: 12,
                  width: "calc(100% - 24px)",
                  height: "calc(100% - 24px)",
                  zIndex: win.zIndex + 100,
                }
              : {
                  left: win.x,
                  top: win.y,
                  width: win.width,
                  height: win.height,
                  zIndex: win.zIndex,
                };

          return (
            <div
              key={win.id}
              style={style}
              onMouseDown={() =>
                focusWindow(win.id)
              }
              className="absolute flex flex-col rounded-xl border border-slate-700/90 bg-slate-900/95 shadow-2xl backdrop-blur-md overflow-hidden transition-shadow"
            >
              {/* Window Title Bar */}
              <div
                onMouseDown={(e) =>
                  handleMouseDown(e, win)
                }
                className="flex cursor-move items-center justify-between border-b border-slate-800 bg-slate-950 px-3.5 py-2"
              >
                <div className="flex items-center gap-2">
                  <span>{win.icon}</span>
                  <span className="font-mono text-xs font-bold text-slate-200">
                    {win.title}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Link
                    href={win.route}
                    className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-sky-400 hover:bg-slate-700"
                  >
                    Full Page ↗
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMinimize(win.id);
                    }}
                    className="h-5 w-5 rounded bg-slate-800 text-xs text-amber-400 hover:bg-slate-700"
                    title="Minimize"
                  >
                    _
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMaximize(win.id);
                    }}
                    className="h-5 w-5 rounded bg-slate-800 text-xs text-emerald-400 hover:bg-slate-700"
                    title="Maximize / Restore"
                  >
                    □
                  </button>
                </div>
              </div>

              {/* Window Content */}
              <div className="flex-1 overflow-y-auto p-3.5 text-xs">
                {win.id === "win-kds" && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>
                        Active KDS Tickets:{" "}
                        <strong className="text-white">
                          {kdsOrders.length}
                        </strong>
                      </span>
                      <span className="font-mono text-[10px] text-emerald-400">
                        WebSocket Sync Active
                      </span>
                    </div>
                    {kdsOrders.length === 0 ? (
                      <p className="rounded-lg bg-slate-950 p-4 text-center text-slate-500">
                        No pending or preparing tickets.
                      </p>
                    ) : (
                      kdsOrders.map((o) => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-2.5"
                        >
                          <div>
                            <p className="font-mono font-bold text-white">
                              {o.id} • {o.brandId}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {o.items
                                .map(
                                  (i) =>
                                    `${i.quantity}x ${i.name}`,
                                )
                                .join(", ")}
                            </p>
                          </div>
                          {onQuickTransition && (
                            <button
                              type="button"
                              onClick={() =>
                                void onQuickTransition(
                                  o.id,
                                  o.status ===
                                    "PENDING"
                                    ? "PREPARING"
                                    : "READY_FOR_PICKUP",
                                )
                              }
                              className={`rounded-lg px-2.5 py-1.5 font-mono text-[10px] font-bold text-white ${
                                o.status ===
                                "PENDING"
                                  ? "bg-sky-600 hover:bg-sky-500"
                                  : "bg-emerald-600 hover:bg-emerald-500"
                              }`}
                            >
                              {o.status ===
                              "PENDING"
                                ? "START PREP"
                                : "MARK READY"}
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {win.id === "win-dispatch" && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>
                        Dispatch Queue:{" "}
                        <strong className="text-white">
                          {dispatchOrders.length}
                        </strong>
                      </span>
                      <span className="font-mono text-[10px] text-amber-400">
                        Courier Pass
                      </span>
                    </div>
                    {dispatchOrders.length ===
                    0 ? (
                      <p className="rounded-lg bg-slate-950 p-4 text-center text-slate-500">
                        No orders awaiting dispatch.
                      </p>
                    ) : (
                      dispatchOrders.map((o) => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-2.5"
                        >
                          <div>
                            <p className="font-mono font-bold text-white">
                              {o.id} ({o.channel})
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Status: {o.status} •{" "}
                              {o.driverName ||
                                "Unassigned"}
                            </p>
                          </div>
                          {onQuickTransition && (
                            <button
                              type="button"
                              onClick={() =>
                                void onQuickTransition(
                                  o.id,
                                  o.status ===
                                    "READY_FOR_PICKUP"
                                    ? "DRIVER_ASSIGNED"
                                    : o.status ===
                                        "DRIVER_ASSIGNED"
                                      ? "PICKED_UP"
                                      : "DISPATCHED",
                                )
                              }
                              className="rounded-lg bg-amber-500 px-2.5 py-1.5 font-mono text-[10px] font-bold text-slate-950 hover:bg-amber-400"
                            >
                              {o.status ===
                              "READY_FOR_PICKUP"
                                ? "ASSIGN DRIVER"
                                : o.status ===
                                    "DRIVER_ASSIGNED"
                                  ? "PICK UP"
                                  : "DISPATCH"}
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {win.id === "win-inventory" && (
                  <div className="space-y-2">
                    {inventory
                      .slice(0, 6)
                      .map((item) => {
                        const low =
                          item.currentStock <=
                          item.reorderThreshold;
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                          >
                            <div>
                              <p className="font-semibold text-slate-200">
                                {item.name}
                              </p>
                              <p className="font-mono text-[10px] text-slate-500">
                                {item.sku} •{" "}
                                {item.category}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                                low
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-emerald-500/20 text-emerald-300"
                              }`}
                            >
                              {item.currentStock}{" "}
                              {item.unit}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}

                {win.id === "win-explorer" && (
                  <div className="space-y-2">
                    {files.slice(0, 5).map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      >
                        <div>
                          <p className="font-mono text-xs font-semibold text-sky-300">
                            {f.name}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {f.category} • {f.size}
                          </p>
                        </div>
                        <Link
                          href="/explorer"
                          className="rounded bg-slate-800 px-2 py-1 font-mono text-[10px] text-slate-300 hover:text-white"
                        >
                          Open
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Persistent OS Taskbar */}
      <div className="relative flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-950 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setStartMenuOpen(!startMenuOpen)
            }
            className="rounded-lg bg-sky-500 px-3 py-1.5 font-mono text-xs font-black text-slate-950 hover:bg-sky-400"
          >
            ❖ START OS
          </button>

          {windows.map((win) => (
            <button
              key={win.id}
              type="button"
              onClick={() =>
                win.minimized
                  ? focusWindow(win.id)
                  : toggleMinimize(win.id)
              }
              className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition ${
                win.minimized
                  ? "border-slate-800 bg-slate-900 text-slate-500"
                  : "border-sky-500/40 bg-sky-500/10 text-sky-300"
              }`}
            >
              {win.icon}{" "}
              {win.title.split("•")[0].trim()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
          <span>Sprint 0 Canonical Store</span>
          <span className="text-emerald-400">
            ● Sandbox Online
          </span>
        </div>

        {startMenuOpen && (
          <div className="absolute bottom-14 left-4 z-50 w-72 rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-sky-400">
              Launch DarKIT OS Module
            </p>
            <div className="grid grid-cols-1 gap-1.5 text-xs">
              {[
                {
                  label: "Order Injection Simulator",
                  href: "/order-injection",
                },
                {
                  label: "Global Live Order Monitor",
                  href: "/live-orders",
                },
                {
                  label: "Kitchen Display System (KDS)",
                  href: "/kds",
                },
                {
                  label: "Dispatch Handoff Hub",
                  href: "/dispatch",
                },
                {
                  label: "Stock Control & Inventory",
                  href: "/inventory",
                },
                {
                  label: "Brand & Menu Matrix",
                  href: "/brands",
                },
                {
                  label: "Kitchen Facility Admin",
                  href: "/kitchens",
                },
                {
                  label: "Analytics & Margin Audit",
                  href: "/analytics",
                },
                {
                  label: "Staff & RBAC Matrix",
                  href: "/staff",
                },
                {
                  label: "Virtual File Explorer",
                  href: "/explorer",
                },
                {
                  label: "OS Personalization Settings",
                  href: "/settings",
                },
              ].map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className="rounded-lg px-2.5 py-1.5 text-slate-200 hover:bg-slate-800 hover:text-sky-300"
                >
                  → {m.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
