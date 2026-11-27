"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CommandPalette } from "./CommandPalette";
import { DEMO_ROLES } from "@/lib/getting-started";

interface SessionEmployee {
  id: string;
  employeeCode: string;
  name: string;
  role: string;
  kitchenId: string | null;
  organizationId?: string;
}

export interface AppShellProps {
  title?: string;
  subtitle?: string;
  activeHub?: string;
  onHubChange?: (hubId: string) => void;
  toolbar?: React.ReactNode;
  rightActions?: React.ReactNode;
  /** Backwards-compatible alias for rightActions used by existing pages */
  actions?: React.ReactNode;
  fullBleed?: boolean;
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  aliases?: string[];
  label: string;
  shortCode: string;
  permission?: string;
}

const PRIMARY_NAV: NavItem[] = [
  {
    href: "/owner",
    aliases: ["/dashboard"],
    label: "Command",
    shortCode: "CMD",
    permission: "OWNER_VIEW",
  },
  {
    href: "/live-orders",
    aliases: ["/orders"],
    label: "Orders",
    shortCode: "ORD",
  },
  {
    href: "/cook",
    aliases: ["/kds"],
    label: "Cook KDS",
    shortCode: "KDS",
    permission: "COOK_ORDERS",
  },
  {
    href: "/dispatch",
    label: "Dispatch",
    shortCode: "DSP",
    permission: "DISPATCH_ORDERS",
  },
  {
    href: "/inventory",
    label: "Inventory",
    shortCode: "INV",
    permission: "INVENTORY_VIEW",
  },
  {
    href: "/invoices",
    label: "GST Invoices",
    shortCode: "GST",
    permission: "OWNER_VIEW",
  },
  {
    href: "/analytics",
    aliases: ["/performance"],
    label: "Analytics",
    shortCode: "ANL",
    permission: "OWNER_VIEW",
  },
];

const ADMIN_NAV: NavItem[] = [
  {
    href: "/brands",
    label: "Brands & Menus",
    shortCode: "BRD",
    permission: "OWNER_VIEW",
  },
  {
    href: "/kitchens",
    label: "Kitchens",
    shortCode: "KIT",
    permission: "OWNER_VIEW",
  },
  {
    href: "/staff",
    label: "Staff & RBAC",
    shortCode: "STF",
    permission: "STAFF_MANAGE",
  },
  {
    href: "/settings",
    label: "Settings",
    shortCode: "SET",
    permission: "OWNER_VIEW",
  },
];

export function AppShell({
  title,
  subtitle,
  activeHub,
  onHubChange,
  toolbar,
  rightActions,
  actions,
  fullBleed = false,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [employee, setEmployee] = useState<SessionEmployee | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [demoSandboxEnabled, setDemoSandboxEnabled] = useState(false);
  const [switchingRole, setSwitchingRole] = useState<string | null>(null);
  const [selectedHub, setSelectedHub] = useState<string>(activeHub ?? "ALL");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (activeHub) setSelectedHub(activeHub);
  }, [activeHub]);

  useEffect(() => {
    let mounted = true;
    fetch("/api/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted || !data) return;
        setDemoSandboxEnabled(Boolean(data.demoSandboxEnabled));
        if (Array.isArray(data.permissions)) {
          setPermissions(data.permissions);
        }
        if (data.employee) {
          setEmployee(data.employee as SessionEmployee);
          if (
            data.employee.role !== "OWNER" &&
            data.employee.kitchenId &&
            !activeHub
          ) {
            setSelectedHub(data.employee.kitchenId);
          }
        }
      })
      .catch(() => {
        // ignore transient network failure
      });
    return () => {
      mounted = false;
    };
  }, [activeHub]);

  useEffect(() => {
    const onHubEvent = (event: Event) => {
      const custom = event as CustomEvent<{ kitchenId?: string }>;
      if (custom.detail?.kitchenId) {
        setSelectedHub(custom.detail.kitchenId);
      }
    };
    window.addEventListener("darkit:hub-changed", onHubEvent);
    return () => window.removeEventListener("darkit:hub-changed", onHubEvent);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleHubSelect = useCallback(
    (hubId: string) => {
      setSelectedHub(hubId);
      onHubChange?.(hubId);
      window.dispatchEvent(
        new CustomEvent("darkit:hub-changed", { detail: { kitchenId: hubId } }),
      );
    },
    [onHubChange],
  );

  const handleDemoRoleSwitch = useCallback(
    async (code: string) => {
      if (!demoSandboxEnabled || switchingRole) return;
      setSwitchingRole(code);
      try {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeCode: code, redirect: pathname }),
        });
        if (res.ok) {
          window.location.reload();
        }
      } finally {
        setSwitchingRole(null);
      }
    },
    [demoSandboxEnabled, switchingRole, pathname],
  );

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/login", { method: "DELETE" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  const canSee = (item: NavItem) => {
    if (!item.permission || permissions.length === 0) return true;
    return (
      permissions.includes(item.permission) ||
      permissions.includes("OWNER_VIEW")
    );
  };

  const visiblePrimary = PRIMARY_NAV.filter(canSee);
  const visibleAdmin = ADMIN_NAV.filter(canSee);

  const isRouteActive = (item: NavItem) => {
    if (pathname === item.href) return true;
    if (item.aliases?.some((alias) => pathname === alias)) return true;
    if (pathname?.startsWith(`${item.href}/`)) return true;
    return false;
  };

  const hubOptions =
    employee?.role !== "OWNER" && employee?.kitchenId
      ? [employee.kitchenId]
      : ["ALL", "K1", "K2", "K3", "K4"];

  const combinedRightActions = rightActions ?? actions;

  return (
    <div className="flex min-h-screen bg-[#09090b] text-zinc-100 selection:bg-indigo-500/30">
      {/* 52px Native Desktop Icon Rail */}
      <aside
        aria-label="Primary Navigation"
        className="sticky top-0 hidden h-screen w-[52px] shrink-0 flex-col items-center justify-between border-r border-white/[0.06] bg-[#09090b] py-2.5 md:flex"
      >
        <div className="flex flex-col items-center gap-1.5">
          <Link
            href={
              permissions.includes("OWNER_VIEW")
                ? "/owner"
                : permissions.includes("COOK_ORDERS")
                  ? "/cook"
                  : permissions.includes("DISPATCH_ORDERS")
                    ? "/dispatch"
                    : "/live-orders"
            }
            title="DarKitOS"
            className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-[#151519] text-[11px] font-bold tracking-tighter text-zinc-100 transition-colors hover:border-white/[0.2]"
          >
            DK
          </Link>

          {visiblePrimary.map((item) => {
            const active = isRouteActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-current={active ? "page" : undefined}
                className={`group relative flex h-9 w-9 items-center justify-center rounded-lg text-[10px] font-semibold tracking-tight transition-colors ${
                  active
                    ? "bg-[#1d1d22] text-zinc-100 ring-1 ring-white/[0.12]"
                    : "text-zinc-500 hover:bg-[#151519] hover:text-zinc-200"
                }`}
              >
                {active && (
                  <span className="absolute -left-[9px] h-4 w-[2px] rounded-r bg-zinc-100" />
                )}
                {item.shortCode}
              </Link>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-1.5 border-t border-white/[0.06] pt-2.5">
          {visibleAdmin.map((item) => {
            const active = isRouteActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-medium tracking-tight transition-colors ${
                  active
                    ? "bg-[#1d1d22] text-zinc-100 ring-1 ring-white/[0.12]"
                    : "text-zinc-500 hover:bg-[#151519] hover:text-zinc-200"
                }`}
              >
                {active && (
                  <span className="absolute -left-[9px] h-3.5 w-[2px] rounded-r bg-zinc-100" />
                )}
                {item.shortCode}
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Main Viewport Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 44px Unified Top Bar */}
        <header className="sticky top-0 z-30 flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-[#09090b]/95 px-4 py-1.5 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="text-xs font-semibold tracking-tight text-zinc-100 md:hidden">
              DarKitOS
            </span>

            {/* Kitchen Hub Segmented Selector */}
            <div
              role="group"
              aria-label="Kitchen Hub Scope"
              className="flex items-center rounded-md border border-white/[0.06] bg-[#151519] p-0.5"
            >
              {hubOptions.map((hub) => {
                const active = selectedHub === hub;
                return (
                  <button
                    key={hub}
                    type="button"
                    onClick={() => handleHubSelect(hub)}
                    className={`rounded-[5px] px-2 py-0.5 text-[11px] font-medium tabular-nums transition-colors ${
                      active
                        ? "bg-[#27272e] text-zinc-100"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {hub}
                  </button>
                );
              })}
            </div>

            {title && (
              <>
                <span className="hidden text-zinc-700 sm:inline">/</span>
                <div className="hidden min-w-0 items-baseline gap-2 sm:flex">
                  <h1 className="truncate text-xs font-semibold text-zinc-100">
                    {title}
                  </h1>
                  {subtitle && (
                    <span className="hidden max-w-xs truncate text-[11px] text-zinc-500 xl:inline">
                      {subtitle}
                    </span>
                  )}
                </div>
              </>
            )}

            {toolbar && (
              <div className="hidden lg:flex lg:items-center lg:gap-1.5">
                {toolbar}
              </div>
            )}
          </div>

          {/* Right Utility Strip */}
          <div className="flex flex-wrap items-center gap-1.5">
            {combinedRightActions}

            {demoSandboxEnabled && (
              <div
                role="group"
                aria-label="Demo role"
                className="hidden items-center rounded-md border border-white/[0.06] bg-[#151519] p-0.5 2xl:flex"
              >
                {DEMO_ROLES.map((r) => {
                  const active = employee?.employeeCode === r.code;
                  return (
                    <button
                      key={r.code}
                      type="button"
                      disabled={switchingRole !== null}
                      onClick={() => void handleDemoRoleSwitch(r.code)}
                      className={`rounded-[5px] px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        active
                          ? "bg-[#27272e] text-zinc-100"
                          : "text-zinc-500 hover:text-zinc-200"
                      }`}
                      title={`Switch demo role to ${r.label}`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/[0.07] bg-[#151519] px-2 text-[11px] text-zinc-400 transition-colors hover:border-white/[0.16] hover:text-zinc-100"
            >
              <span className="hidden sm:inline">Command</span>
              <kbd className="rounded bg-[#1d1d22] px-1 py-0.5 font-mono text-[10px] text-zinc-400">
                ⌘K
              </kbd>
            </button>

            {employee && (
              <div className="hidden items-center gap-1.5 rounded-md border border-white/[0.06] bg-[#151519] px-2 py-1 text-[11px] sm:flex">
                <span className="max-w-[110px] truncate font-medium text-zinc-200">
                  {employee.name}
                </span>
                <span className="text-zinc-600">·</span>
                <span className="font-mono text-[10px] text-zinc-400">
                  {employee.role}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex h-7 items-center rounded-md border border-white/[0.07] bg-[#151519] px-2 text-[11px] font-medium text-zinc-400 transition-colors hover:border-rose-500/40 hover:text-rose-300 disabled:opacity-50"
            >
              {signingOut ? "..." : "Exit"}
            </button>
          </div>
        </header>

        {/* Main Work Surface */}
        <main
          className={`flex-1 bg-[#0e0e11] pb-16 md:pb-0 ${
            fullBleed
              ? "flex min-h-0 flex-col"
              : "mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6"
          }`}
        >
          {children}
        </main>
      </div>

      {/* Mobile Bottom Station Dock */}
      <nav
        aria-label="Mobile Station Navigation"
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-white/[0.06] bg-[#09090b]/95 py-1.5 backdrop-blur-md md:hidden"
      >
        {visiblePrimary.slice(0, 5).map((item) => {
          const active = isRouteActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                active ? "bg-[#1d1d22] text-zinc-100" : "text-zinc-400"
              }`}
            >
              {item.shortCode}
            </Link>
          );
        })}
      </nav>

      {/* Global Command Palette */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        permissions={permissions}
        allowedKitchens={
          employee?.role !== "OWNER" && employee?.kitchenId
            ? [employee.kitchenId]
            : undefined
        }
        onSelectHub={handleHubSelect}
        demoSandboxEnabled={demoSandboxEnabled}
        onSwitchDemoRole={(code) => void handleDemoRoleSwitch(code)}
      />
    </div>
  );
}

export default AppShell;
