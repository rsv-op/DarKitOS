"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import GuideIcon, { type GuideIconName } from "@/components/GuideIcon";
import { DEMO_ROLES } from "@/lib/getting-started";
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
  demoSandboxEnabled?: boolean;
}

interface NavItem {
  label: string;
  href: string;
  aliases?: string[];
  group: "command" | "operations" | "enterprise";
  permission?: PermissionCode;
  icon: GuideIconName;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Owner Showcase",
    href: "/dashboard",
    aliases: ["/owner"],
    group: "command",
    permission: "OWNER_VIEW",
    icon: "home",
  },
  {
    label: "Getting started",
    href: "/",
    group: "command",
    icon: "info",
  },
  {
    label: "Analytics & Margin",
    href: "/analytics",
    aliases: ["/performance"],
    group: "command",
    permission: "OWNER_VIEW",
    icon: "chart",
  },
  {
    label: "Sample Orders",
    href: "/order-injection",
    aliases: ["/dev"],
    group: "operations",
    permission: "ORDER_INJECT",
    icon: "ticket",
  },
  {
    label: "Live Orders",
    href: "/live-orders",
    aliases: ["/orders"],
    group: "operations",
    icon: "list",
  },
  {
    label: "Kitchen Board",
    href: "/kds",
    aliases: ["/cook"],
    group: "operations",
    permission: "COOK_ORDERS",
    icon: "cook",
  },
  {
    label: "Dispatch",
    href: "/dispatch",
    group: "operations",
    permission: "DISPATCH_ORDERS",
    icon: "truck",
  },
  {
    label: "Inventory",
    href: "/inventory",
    group: "operations",
    permission: "INVENTORY_VIEW",
    icon: "box",
  },
  {
    label: "Brands & Menus",
    href: "/brands",
    group: "enterprise",
    permission: "OWNER_VIEW",
    icon: "brand",
  },
  {
    label: "Kitchens",
    href: "/kitchens",
    group: "enterprise",
    permission: "OWNER_VIEW",
    icon: "home",
  },
  {
    label: "GST Invoices",
    href: "/invoices",
    group: "enterprise",
    permission: "OWNER_VIEW",
    icon: "ticket",
  },
  {
    label: "Staff & Access",
    href: "/staff",
    group: "enterprise",
    permission: "STAFF_MANAGE",
    icon: "staff",
  },
  {
    label: "File Explorer",
    href: "/explorer",
    group: "enterprise",
    permission: "OWNER_VIEW",
    icon: "folder",
  },
  {
    label: "Settings",
    href: "/settings",
    group: "enterprise",
    permission: "OWNER_VIEW",
    icon: "settings",
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
  const [session, setSession] = useState<SessionData | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adrModalOpen, setAdrModalOpen] = useState(false);
  const [switchingCode, setSwitchingCode] = useState<string | null>(null);
  const [clock, setClock] = useState<string>("");

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch("/api/session", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as SessionData;
        setSession(data);
      }
    } catch {
      // Ignore transient network errors
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession, pathname]);

  // Listen for live settings updates (theme/currency/SLA) emitted by /settings
  useEffect(() => {
    const handleSettingsUpdated = (event: Event) => {
      const custom = event as CustomEvent<SystemSettings>;
      if (custom.detail) {
        setSession((prev) =>
          prev ? { ...prev, settings: custom.detail } : prev,
        );
      } else {
        void loadSession();
      }
    };
    window.addEventListener("darkit:settings-updated", handleSettingsUpdated);
    return () => {
      window.removeEventListener(
        "darkit:settings-updated",
        handleSettingsUpdated,
      );
    };
  }, [loadSession]);

  // Escape key closes System Details modal or mobile drawer
  useEffect(() => {
    if (!adrModalOpen && !mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAdrModalOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [adrModalOpen, mobileMenuOpen]);

  useEffect(() => {
    const updateClock = () => {
      setClock(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    };
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
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
    if (item.aliases?.some((a) => pathname === a)) return true;
    return false;
  };

  const currentEmp = session?.employee;
  const demoSandboxEnabled = session?.demoSandboxEnabled ?? false;

  const visibleNavItems = useMemo(() => {
    if (!session) return NAV_ITEMS;
    const permSet = new Set(session.permissions || []);
    return NAV_ITEMS.filter(
      (item) => !item.permission || permSet.has(item.permission),
    );
  }, [session]);

  const commandItems = visibleNavItems.filter((i) => i.group === "command");
  const operationsItems = visibleNavItems.filter(
    (i) => i.group === "operations",
  );
  const enterpriseItems = visibleNavItems.filter(
    (i) => i.group === "enterprise",
  );

  const theme = session?.settings?.theme || "obsidian";
  const currency = session?.settings?.currency || "INR";

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
      {/* Workspace toolbar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6">
          {/* Brand and mobile navigation */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 lg:hidden"
              aria-label="Open workspace navigation"
              aria-expanded={mobileMenuOpen}
            >
              ☰
            </button>

            <Link
              href={
                session?.permissions?.includes("OWNER_VIEW")
                  ? "/dashboard"
                  : session?.permissions?.includes("COOK_ORDERS")
                    ? "/kds"
                    : session?.permissions?.includes("DISPATCH_ORDERS")
                      ? "/dispatch"
                      : "/live-orders"
              }
              className="flex items-center gap-2.5 group"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200 transition group-hover:border-cyan-300/45">
                <GuideIcon name="brand" />
              </span>
              <div>
                <span className="text-sm font-bold tracking-tight text-white">
                  DarKit<span className="text-cyan-200">OS</span>
                </span>
                <p className="hidden text-[10px] text-slate-400 sm:block">
                  Cloud kitchen workspace · {currency}
                </p>
              </div>
            </Link>
          </div>

          {/* Demo roles (Sandbox only), System Roadmap details, and account */}
          <div className="flex items-center gap-2 sm:gap-3">
            {demoSandboxEnabled && (
              <div
                role="group"
                aria-label="Demo role"
                className="hidden lg:flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/90 p-1"
              >
                <span className="px-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  Demo role:
                </span>
                {DEMO_ROLES.map((p) => {
                  const active = currentEmp?.employeeCode === p.code;
                  return (
                    <button
                      key={p.code}
                      type="button"
                      disabled={switchingCode !== null}
                      onClick={() => void handleQuickSwitch(p.code)}
                      className={`rounded-lg px-2 py-1 font-mono text-[10px] font-bold transition ${
                        active
                          ? "bg-sky-500 text-slate-950 shadow-sm"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                      aria-pressed={active}
                      title={`Switch to ${p.label}`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => setAdrModalOpen(true)}
              className="hidden rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 sm:inline-flex"
            >
              System details
            </button>

            {currentEmp && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5">
                <div className="hidden text-right sm:block">
                  <p className="text-xs font-bold leading-none text-white">
                    {currentEmp.name}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-emerald-400">
                    {DEMO_ROLES.find(({ role }) => role === currentEmp.role)
                      ?.label ?? currentEmp.role}{" "}
                    • {currentEmp.kitchenId || "GLOBAL"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="ml-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-[10px] font-semibold text-slate-300 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
                  title="Sign out of station"
                >
                  Sign out
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

      {/* Main Layout: Role-Filtered Sidebar + Content */}
      <div className="mx-auto flex w-full max-w-[1600px] flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-slate-800/80 bg-slate-950/50 p-4">
          <div className="space-y-6">
            {commandItems.length > 0 && (
              <div>
                <p className="px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Workspace
                </p>
                <nav aria-label="Workspace" className="mt-2 space-y-1">
                  {commandItems.map((item) => {
                    const active = isRouteActive(item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                          active
                            ? "bg-gradient-to-r from-sky-500/20 to-emerald-500/10 text-white border border-sky-500/40 shadow-[0_0_20px_rgba(14,165,233,0.12)]"
                            : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <GuideIcon
                            name={item.icon}
                            className="h-4 w-4 shrink-0 text-sky-300"
                          />
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            )}

            {operationsItems.length > 0 && (
              <div>
                <p className="px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Orders &amp; stock
                </p>
                <nav aria-label="Orders and stock" className="mt-2 space-y-1">
                  {operationsItems.map((item) => {
                    const active = isRouteActive(item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                          active
                            ? "bg-gradient-to-r from-sky-500/20 to-emerald-500/10 text-white border border-sky-500/40 shadow-[0_0_20px_rgba(14,165,233,0.12)]"
                            : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <GuideIcon
                            name={item.icon}
                            className="h-4 w-4 shrink-0 text-emerald-300"
                          />
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            )}

            {enterpriseItems.length > 0 && (
              <div>
                <p className="px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Team &amp; setup
                </p>
                <nav aria-label="Team and setup" className="mt-2 space-y-1">
                  {enterpriseItems.map((item) => {
                    const active = isRouteActive(item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                          active
                            ? "bg-gradient-to-r from-sky-500/20 to-emerald-500/10 text-white border border-sky-500/40 shadow-[0_0_20px_rgba(14,165,233,0.12)]"
                            : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <GuideIcon
                            name={item.icon}
                            className="h-4 w-4 shrink-0 text-amber-300"
                          />
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
            <p className="text-xs font-semibold text-slate-200">
              {demoSandboxEnabled
                ? "DarKitOS Demo Sandbox"
                : "DarKitOS Multi-Tenant Cloud"}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {demoSandboxEnabled
                ? "Demo role switcher enabled. Multi-tenant RBAC, PostgreSQL persistence, and Realtime KDS active."
                : "Two-level Organization & Kitchen RBAC with instant account revocation enforced server-side."}
            </p>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative z-10 flex w-72 flex-col justify-between bg-slate-950 p-4 border-r border-slate-800 overflow-y-auto">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-mono text-base font-bold text-white">
                    Workspace navigation
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Close workspace navigation"
                    className="rounded-lg border border-slate-800 px-2.5 py-1 text-xs text-slate-400"
                  >
                    ✕
                  </button>
                </div>

                {/* Mobile Persona Switcher (Sandbox only) */}
                {demoSandboxEnabled && (
                  <div
                    role="group"
                    aria-label="Demo role"
                    className="mb-4 rounded-xl border border-slate-800 bg-slate-900 p-2.5"
                  >
                    <p className="mb-2 font-mono text-[10px] uppercase text-slate-400">
                      Switch demo role
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {DEMO_ROLES.map((p) => (
                        <button
                          key={p.code}
                          type="button"
                          disabled={switchingCode !== null}
                          aria-pressed={currentEmp?.employeeCode === p.code}
                          onClick={() => void handleQuickSwitch(p.code)}
                          className={`rounded-lg px-2 py-1.5 font-mono text-[10px] font-bold ${
                            currentEmp?.employeeCode === p.code
                              ? "bg-sky-500 text-slate-950"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <nav aria-label="Workspace" className="space-y-1">
                  {visibleNavItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isRouteActive(item) ? "page" : undefined}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium ${
                        isRouteActive(item)
                          ? "bg-sky-500/20 text-white border border-sky-500/40"
                          : "text-slate-400 hover:bg-slate-900"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <GuideIcon
                          name={item.icon}
                          className="h-4 w-4 shrink-0 text-cyan-300"
                        />
                        {item.label}
                      </span>
                    </Link>
                  ))}
                </nav>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAdrModalOpen(true);
                  }}
                  className="mt-4 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 sm:hidden"
                >
                  System details
                </button>
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
                  DarKitOS · Cloud kitchen workspace
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
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

      {/* Honest Architecture & Roadmap Reference Modal */}
      {adrModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="system-details-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAdrModalOpen(false);
          }}
        >
          <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-sky-400">
                  Architecture &amp; Production Readiness
                </span>
                <h2
                  id="system-details-modal-title"
                  className="mt-1 text-xl font-black text-white"
                >
                  DarKitOS — Sprint 0 Verified Baseline &amp; Rollout Plan
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAdrModalOpen(false)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white"
              >
                Close ✕
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <p className="font-mono text-xs font-bold uppercase text-emerald-400">
                  Active Now • Sprint 0
                </p>
                <h3 className="mt-1 font-bold text-white">
                  INR Showcase &amp; Core Engine
                </h3>
                <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
                  <li>
                    • Single canonical store boundary (
                    <code className="text-emerald-300">
                      UI → /api/* → lib/store.ts
                    </code>
                    ).
                  </li>
                  <li>
                    • Atomic recipe depletion on{" "}
                    <code className="text-emerald-300">
                      PENDING → PREPARING
                    </code>
                    .
                  </li>
                  <li>
                    • Stage-aware cancellations (Pre-Prep, Mid-Prep ₹ Loss,
                    Post-Pickup Claim).
                  </li>
                  <li>
                    • Signed JWT auth, server-side RBAC, kitchen isolation, and
                    Owner Brief `.md` export.
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
                <p className="font-mono text-xs font-bold uppercase text-sky-400">
                  Next • Sprints 1 &amp; 2
                </p>
                <h3 className="mt-1 font-bold text-white">
                  Database, Auth &amp; Realtime
                </h3>
                <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
                  <li>
                    • Supabase PostgreSQL (Mumbai{" "}
                    <code className="text-sky-300">ap-south-1</code>) + Drizzle
                    ORM.
                  </li>
                  <li>
                    • Per-kitchen{" "}
                    <code className="text-sky-300">
                      (kitchenId, ingredientId)
                    </code>{" "}
                    ledgers &amp; stock transfers.
                  </li>
                  <li>
                    • Supabase Auth (Email/OTP) + PostgreSQL RLS tenant
                    isolation.
                  </li>
                  <li>
                    • Supabase Realtime replacing HTTP polling (&lt;500ms KDS
                    updates).
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <p className="font-mono text-xs font-bold uppercase text-emerald-400">
                  Complete • Sprints 3 &amp; 4
                </p>
                <h3 className="mt-1 font-bold text-white">
                  India GST, Aggregators, Hardware &amp; AI
                </h3>
                <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
                  <li>
                    • Sprint 3A: Day-1 GST invoicing (CGST/SGST/FSSAI), Tally
                    CSV, Razorpay Direct UPI.
                  </li>
                  <li>
                    • Sprint 3B: UrbanPiper Swiggy/Zomato webhooks, Outbox +
                    Upstash QStash, Interakt WhatsApp alerts.
                  </li>
                  <li>
                    • Sprint 4: 80mm thermal KOT print bridge, Web Audio SLA
                    chimes, USB scale station &amp; Gemini{" "}
                    <code className="text-emerald-300">/api/ai/diagnose</code>{" "}
                    copilot.
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="font-mono text-xs font-bold uppercase text-slate-400">
                Canonical Order Lifecycle
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs">
                {[
                  "PENDING",
                  "PREPARING (Deplete Stock)",
                  "READY_FOR_PICKUP",
                  "DRIVER_ASSIGNED",
                  "PICKED_UP",
                  "DISPATCHED",
                ].map((step, i, arr) => (
                  <React.Fragment key={step}>
                    <span className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-200">
                      {step}
                    </span>
                    {i < arr.length - 1 && (
                      <span className="text-sky-400">→</span>
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
