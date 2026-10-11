"use client";

import React, {
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import type {
  Employee,
  PermissionCode,
  SystemSettings,
} from "@/lib/db";

interface SessionData {
  authenticated: boolean;
  employee: Employee | null;
  permissions: PermissionCode[];
  employees: Employee[];
  settings?: SystemSettings;
}

interface NavItem {
  label: string;
  href: string;
  aliases?: string[];
  badge?: string;
  group: "command" | "operations" | "enterprise";
  permission?: PermissionCode;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Command Center",
    href: "/dashboard",
    aliases: ["/owner"],
    group: "command",
    icon: "⌘",
  },
  {
    label: "BI & VerticalForge",
    href: "/analytics",
    aliases: ["/performance"],
    badge: "ROI",
    group: "command",
    icon: "◈",
  },
  {
    label: "Order Injection",
    href: "/order-injection",
    aliases: ["/dev"],
    badge: "SIM",
    group: "operations",
    icon: "⚡",
  },
  {
    label: "Live Orders",
    href: "/live-orders",
    aliases: ["/orders"],
    group: "operations",
    icon: "◎",
  },
  {
    label: "Cook KDS",
    href: "/kds",
    aliases: ["/cook"],
    badge: "KDS",
    group: "operations",
    icon: "🔥",
  },
  {
    label: "Dispatch Hub",
    href: "/dispatch",
    group: "operations",
    icon: "✦",
  },
  {
    label: "Stock Control",
    href: "/inventory",
    group: "operations",
    icon: "▣",
  },
  {
    label: "Virtual Brands",
    href: "/brands",
    group: "enterprise",
    icon: "❖",
  },
  {
    label: "Physical Kitchens",
    href: "/kitchens",
    group: "enterprise",
    icon: "⌂",
  },
  {
    label: "Staff & RBAC",
    href: "/staff",
    group: "enterprise",
    icon: "⛨",
  },
  {
    label: "File Explorer",
    href: "/explorer",
    group: "enterprise",
    icon: "▤",
  },
  {
    label: "OS Settings",
    href: "/settings",
    group: "enterprise",
    icon: "⚙",
  },
];

const QUICK_PERSONAS = [
  {
    code: "OWNER-01",
    label: "Owner (Patric)",
    role: "OWNER",
    color: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  },
  {
    code: "0001",
    label: "Manager (Priya • K1)",
    role: "MANAGER",
    color: "text-purple-300 border-purple-500/40 bg-purple-500/10",
  },
  {
    code: "2001",
    label: "Line Cook (Rajesh • K1)",
    role: "LINE_COOK",
    color: "text-sky-300 border-sky-500/40 bg-sky-500/10",
  },
  {
    code: "3001",
    label: "Dispatch (Arjun • K1)",
    role: "DISPATCH",
    color: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  },
];

export default function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] =
    useState<SessionData | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);
  const [adrModalOpen, setAdrModalOpen] =
    useState(false);
  const [switchingCode, setSwitchingCode] =
    useState<string | null>(null);
  const [clock, setClock] = useState<string>("");

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch("/api/session", {
        cache: "no-store",
      });
      if (res.ok) {
        const data =
          (await res.json()) as SessionData;
        setSession(data);
      }
    } catch {
      // Ignore transient network errors
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession, pathname]);

  useEffect(() => {
    const updateClock = () => {
      setClock(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    };
    updateClock();
    const timer = window.setInterval(
      updateClock,
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);

  async function handleQuickSwitch(code: string) {
    setSwitchingCode(code);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeCode: code,
          redirect: pathname,
        }),
      });
      if (res.ok) {
        await loadSession();
        window.location.reload();
      }
    } finally {
      setSwitchingCode(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/login", {
      method: "DELETE",
    });
    router.replace("/login");
    router.refresh();
  }

  const isRouteActive = (item: NavItem) => {
    if (pathname === item.href) return true;
    if (
      item.aliases?.some((a) => pathname === a)
    )
      return true;
    return false;
  };

  const currentEmp = session?.employee;
  const syncMode =
    session?.settings?.syncMode || "WEBSOCKET";
  const circuitState =
    session?.settings?.circuitBreakerState ||
    "CLOSED";
  const theme =
    session?.settings?.theme || "obsidian";

  const themeBg =
    theme === "midnight"
      ? "bg-[#070B19]"
      : theme === "cyber-emerald"
        ? "bg-[#04110E]"
        : theme === "titanium"
          ? "bg-slate-900"
          : "bg-[#070A12]";

  return (
    <div
      className={`min-h-screen ${themeBg} text-slate-100 flex flex-col selection:bg-sky-500/30 selection:text-sky-200`}
    >
      {/* Top Cloud7 / VerticalForge / DarKIT OS Telemetry Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6">
          {/* Left: Brand Logo & Ecosystem Status */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setMobileMenuOpen(!mobileMenuOpen)
              }
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 lg:hidden"
              aria-label="Toggle navigation"
            >
              ☰
            </button>

            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 group"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-500/40 bg-gradient-to-br from-sky-500/20 to-emerald-500/20 shadow-[0_0_20px_rgba(14,165,233,0.2)] transition group-hover:border-sky-400">
                <span className="font-mono text-sm font-black tracking-tighter text-sky-400">
                  DK
                </span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-sm font-black tracking-tight text-white">
                    DarKIT
                  </span>
                  <span className="font-mono text-sm font-black text-emerald-400">
                    OS
                  </span>
                  <span className="hidden rounded border border-slate-700/80 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:inline-block">
                    v4.2 • Cloud7
                  </span>
                </div>
                <p className="hidden text-[10px] text-slate-400 sm:block">
                  VerticalForge Diagnostic & Kitchen Command
                </p>
              </div>
            </Link>

            {/* Telemetry Pills */}
            <div className="hidden xl:flex items-center gap-2 pl-4 border-l border-slate-800/80">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                SYNC: {syncMode}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-sky-300">
                RLS: is_local=true
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold ${
                  circuitState === "CLOSED"
                    ? "border-slate-700 bg-slate-900 text-slate-300"
                    : circuitState === "HALF_OPEN"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                      : "border-red-500/40 bg-red-500/10 text-red-300"
                }`}
              >
                GATEWAY: {circuitState}
              </span>
            </div>
          </div>

          {/* Right: Persona Switcher, ADR Reference, Clock, User & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Role Switcher for seamless RBAC testing */}
            <div className="hidden md:flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/90 p-1">
              <span className="px-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                Persona:
              </span>
              {QUICK_PERSONAS.map((p) => {
                const active =
                  currentEmp?.employeeCode ===
                  p.code;
                return (
                  <button
                    key={p.code}
                    type="button"
                    disabled={
                      switchingCode !== null
                    }
                    onClick={() =>
                      void handleQuickSwitch(
                        p.code,
                      )
                    }
                    className={`rounded-lg px-2 py-1 font-mono text-[10px] font-bold transition ${
                      active
                        ? "bg-sky-500 text-slate-950 shadow-sm"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                    title={`Switch to ${p.label}`}
                  >
                    {p.role === "LINE_COOK"
                      ? "COOK"
                      : p.role}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setAdrModalOpen(true)}
              className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 font-mono text-xs font-semibold text-sky-300 transition hover:bg-sky-500/20"
            >
              ADR Spec
            </button>

            {currentEmp && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5">
                <div className="text-right">
                  <p className="text-xs font-bold leading-none text-white">
                    {currentEmp.name}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-emerald-400">
                    {currentEmp.role} •{" "}
                    {currentEmp.kitchenId ||
                      "GLOBAL"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void handleLogout()
                  }
                  className="ml-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-[10px] font-semibold text-slate-300 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
                  title="Sign out of station"
                >
                  Exit
                </button>
              </div>
            )}

            {clock && (
              <span className="hidden lg:inline-block font-mono text-xs text-slate-400">
                {clock}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Fluidic Layout: Sidebar + Content */}
      <div className="mx-auto flex w-full max-w-[1600px] flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-slate-800/80 bg-slate-950/50 p-4">
          <div className="space-y-6">
            <div>
              <p className="px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Command & Diagnostics
              </p>
              <nav className="mt-2 space-y-1">
                {NAV_ITEMS.filter(
                  (i) => i.group === "command",
                ).map((item) => {
                  const active =
                    isRouteActive(item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                        active
                          ? "bg-gradient-to-r from-sky-500/20 to-emerald-500/10 text-white border border-sky-500/40 shadow-[0_0_20px_rgba(14,165,233,0.12)]"
                          : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="font-mono text-base text-sky-400">
                          {item.icon}
                        </span>
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="rounded-md bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-300">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div>
              <p className="px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Live Kitchen Pipeline
              </p>
              <nav className="mt-2 space-y-1">
                {NAV_ITEMS.filter(
                  (i) => i.group === "operations",
                ).map((item) => {
                  const active =
                    isRouteActive(item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                        active
                          ? "bg-gradient-to-r from-sky-500/20 to-emerald-500/10 text-white border border-sky-500/40 shadow-[0_0_20px_rgba(14,165,233,0.12)]"
                          : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="font-mono text-base text-emerald-400">
                          {item.icon}
                        </span>
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="rounded-md bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div>
              <p className="px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Enterprise & OS Modules
              </p>
              <nav className="mt-2 space-y-1">
                {NAV_ITEMS.filter(
                  (i) => i.group === "enterprise",
                ).map((item) => {
                  const active =
                    isRouteActive(item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                        active
                          ? "bg-gradient-to-r from-sky-500/20 to-emerald-500/10 text-white border border-sky-500/40 shadow-[0_0_20px_rgba(14,165,233,0.12)]"
                          : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="font-mono text-base text-amber-400">
                          {item.icon}
                        </span>
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Ecosystem Footer Card */}
          <div className="mt-6 rounded-2xl border border-slate-800/90 bg-slate-900/60 p-3.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-sky-400">
                Cloud7 Matrix
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-200">
              Single Canonical Store
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              UI → API → Domain → Store → Persistence
            </p>
            {session?.permissions && (
              <div className="mt-2.5 flex flex-wrap gap-1">
                {session.permissions
                  .slice(0, 4)
                  .map((perm) => (
                    <span
                      key={perm}
                      className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-[9px] text-slate-400"
                    >
                      {perm}
                    </span>
                  ))}
                {session.permissions.length >
                  4 && (
                  <span className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-[9px] text-sky-400">
                    +
                    {session.permissions.length -
                      4}{" "}
                    more
                  </span>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() =>
                setMobileMenuOpen(false)
              }
            />
            <div className="relative z-10 flex w-72 flex-col justify-between bg-slate-950 p-4 border-r border-slate-800 overflow-y-auto">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-mono text-base font-bold text-white">
                    DarKIT OS Navigation
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setMobileMenuOpen(false)
                    }
                    className="rounded-lg border border-slate-800 px-2.5 py-1 text-xs text-slate-400"
                  >
                    ✕
                  </button>
                </div>

                {/* Mobile Persona Switcher */}
                <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900 p-2.5">
                  <p className="mb-2 font-mono text-[10px] uppercase text-slate-400">
                    Switch Active Persona
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {QUICK_PERSONAS.map((p) => (
                      <button
                        key={p.code}
                        type="button"
                        onClick={() =>
                          void handleQuickSwitch(
                            p.code,
                          )
                        }
                        className={`rounded-lg px-2 py-1.5 font-mono text-[10px] font-bold ${
                          currentEmp?.employeeCode ===
                          p.code
                            ? "bg-sky-500 text-slate-950"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {p.role}
                      </button>
                    ))}
                  </div>
                </div>

                <nav className="space-y-1">
                  {NAV_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() =>
                        setMobileMenuOpen(false)
                      }
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium ${
                        isRouteActive(item)
                          ? "bg-sky-500/20 text-white border border-sky-500/40"
                          : "text-slate-400 hover:bg-slate-900"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{item.icon}</span>
                        {item.label}
                      </span>
                    </Link>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        )}

        {/* Main Workspace */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          {/* Page Header */}
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-sky-400">
                  DarKIT OS • Unified Vertical Operating System
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-sm text-slate-400">
                  {subtitle}
                </p>
              )}
            </div>

            {actions && (
              <div className="flex flex-wrap items-center gap-2.5">
                {actions}
              </div>
            )}
          </div>

          {children}
        </main>
      </div>

      {/* Cloud7 / VerticalForge / DarKIT OS ADR Reference Modal */}
      {adrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-sky-400">
                  Architecture Decision Record (ADR)
                </span>
                <h2 className="mt-1 text-xl font-black text-white">
                  Ecosystem Integration: Cloud7, VerticalForge & DarKIT OS
                </h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  setAdrModalOpen(false)
                }
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white"
              >
                Close ✕
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
                <p className="font-mono text-xs font-bold uppercase text-sky-400">
                  Layer 1 • Cloud7
                </p>
                <h3 className="mt-1 font-bold text-white">
                  Parent Infrastructure & Delivery
                </h3>
                <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
                  <li>
                    • Shared DB, Shared Schema enforced by PostgreSQL Row-Level Security (RLS).
                  </li>
                  <li>
                    • Transaction-mode PgBouncer pooling with{" "}
                    <code className="text-sky-300">
                      set_config(..., is_local=true)
                    </code>
                    .
                  </li>
                  <li>
                    • Edge API Gateway with Token Bucket Rate Limiting & Circuit Breaker (
                    <code className="text-sky-300">
                      Closed → Open → Half-Open
                    </code>
                    ).
                  </li>
                  <li>
                    • Autonomous Agent Integration (
                    <code className="text-sky-300">
                      wshobson/agents
                    </code>{" "}
                    200+ specialist agents).
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
                <p className="font-mono text-xs font-bold uppercase text-purple-400">
                  Layer 2 • VerticalForge
                </p>
                <h3 className="mt-1 font-bold text-white">
                  Diagnostic & Value Engine
                </h3>
                <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
                  <li>
                    • Quote-to-Cash Revenue Leakage Engine:{" "}
                    <code className="text-purple-300">
                      (Potential − Collected) ÷ Potential × 100
                    </code>
                    .
                  </li>
                  <li>
                    • Audits 5 vectors: Failed Payments, Expired Discounts, Unbilled Usage, Contract-to-Billing Drift, Lapsed Renewals.
                  </li>
                  <li>
                    • Food Yield & COGS Variance:{" "}
                    <code className="text-purple-300">
                      (Usable Weight ÷ Purchased Weight) × 100
                    </code>
                    .
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <p className="font-mono text-xs font-bold uppercase text-emerald-400">
                  Layer 3 • DarKIT OS
                </p>
                <h3 className="mt-1 font-bold text-white">
                  Unified Vertical Operating System
                </h3>
                <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
                  <li>
                    • Single Canonical Store:{" "}
                    <code className="text-emerald-300">
                      UI → API → Domain → Store → Persistence
                    </code>
                    .
                  </li>
                  <li>
                    • Many-to-many{" "}
                    <code className="text-emerald-300">
                      BrandKitchen
                    </code>{" "}
                    validation & two-phase atomic webhook idempotency.
                  </li>
                  <li>
                    • Atomic Inventory Consumption on{" "}
                    <code className="text-emerald-300">
                      PENDING → PREPARING
                    </code>
                    .
                  </li>
                  <li>
                    • Stage-dependent Cancellations (Pre-Prep Restore, Mid-Prep Loss, Post-Pickup Claim).
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="font-mono text-xs font-bold uppercase text-slate-400">
                Canonical Order Lifecycle & Pipeline
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs">
                {[
                  "LOGIN",
                  "AUTH & RBAC",
                  "ORDER INJECTION",
                  "LIVE ORDERS",
                  "COOK KDS (PREPARING → READY)",
                  "DISPATCH (DRIVER → PICKUP → DISPATCHED)",
                  "INVENTORY LEDGER",
                  "VERTICALFORGE BI",
                ].map((step, i, arr) => (
                  <React.Fragment key={step}>
                    <span className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-200">
                      {step}
                    </span>
                    {i < arr.length - 1 && (
                      <span className="text-sky-400">
                        →
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
