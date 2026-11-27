"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DEMO_ROLES } from "@/lib/getting-started";

export interface CommandItem {
  id: string;
  group: "Stations" | "Kitchen Hubs" | "Quick Actions" | "Demo Roles";
  label: string;
  hint?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  permissions?: string[];
  allowedKitchens?: string[];
  onSelectHub?: (hubId: string) => void;
  demoSandboxEnabled?: boolean;
  onSwitchDemoRole?: (code: string) => void;
}

const STATION_COMMANDS = [
  {
    id: "nav-owner",
    label: "Owner Command Center",
    href: "/owner",
    hint: "/owner",
    perm: "OWNER_VIEW",
  },
  {
    id: "nav-orders",
    label: "Live Orders Inbox",
    href: "/live-orders",
    hint: "/live-orders",
    perm: null,
  },
  {
    id: "nav-cook",
    label: "Cook KDS Board",
    href: "/cook",
    hint: "/cook",
    perm: "COOK_ORDERS",
  },
  {
    id: "nav-dispatch",
    label: "Dispatch & Rider Handoff",
    href: "/dispatch",
    hint: "/dispatch",
    perm: "DISPATCH_ORDERS",
  },
  {
    id: "nav-inventory",
    label: "Per-Kitchen Inventory Ledger",
    href: "/inventory",
    hint: "/inventory",
    perm: "INVENTORY_VIEW",
  },
  {
    id: "nav-invoices",
    label: "GST Tax Invoices & Tally Export",
    href: "/invoices",
    hint: "/invoices",
    perm: "OWNER_VIEW",
  },
  {
    id: "nav-analytics",
    label: "Throughput & Leakage Analytics",
    href: "/analytics",
    hint: "/analytics",
    perm: "OWNER_VIEW",
  },
  {
    id: "nav-brands",
    label: "Brands & Menu BOMs",
    href: "/brands",
    hint: "/brands",
    perm: "OWNER_VIEW",
  },
  {
    id: "nav-kitchens",
    label: "Kitchen Facilities",
    href: "/kitchens",
    hint: "/kitchens",
    perm: "OWNER_VIEW",
  },
  {
    id: "nav-staff",
    label: "Staff & Role Access",
    href: "/staff",
    hint: "/staff",
    perm: "STAFF_MANAGE",
  },
  {
    id: "nav-settings",
    label: "Integrations, Outbox & SLAs",
    href: "/settings",
    hint: "/settings",
    perm: "OWNER_VIEW",
  },
];

const HUBS = [
  { id: "ALL", label: "All Kitchen Hubs (Network View)" },
  { id: "K1", label: "K1 — Gurugram Sector 29 Hub" },
  { id: "K2", label: "K2 — Noida Sector 18 Hub" },
  { id: "K3", label: "K3 — South Delhi Hauz Khas Hub" },
  { id: "K4", label: "K4 — Cyber City DLF Phase 2 Hub" },
];

export function CommandPalette({
  open,
  onClose,
  permissions = [],
  allowedKitchens,
  onSelectHub,
  demoSandboxEnabled = false,
  onSwitchDemoRole,
}: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const items = useMemo<CommandItem[]>(() => {
    const hasPerm = (perm: string | null) =>
      !perm ||
      permissions.length === 0 ||
      permissions.includes(perm) ||
      permissions.includes("OWNER_VIEW");

    const stationItems: CommandItem[] = STATION_COMMANDS.filter((s) =>
      hasPerm(s.perm),
    ).map((s) => ({
      id: s.id,
      group: "Stations",
      label: s.label,
      hint: s.hint,
      onSelect: () => {
        onClose();
        router.push(s.href);
      },
    }));

    const hubItems: CommandItem[] = HUBS.filter(
      (h) =>
        !allowedKitchens ||
        allowedKitchens.length === 0 ||
        (h.id === "ALL" && allowedKitchens.length > 1) ||
        allowedKitchens.includes(h.id),
    ).map((h) => ({
      id: `hub-${h.id}`,
      group: "Kitchen Hubs",
      label: `Scope to ${h.label}`,
      hint: h.id,
      onSelect: () => {
        onSelectHub?.(h.id);
        window.dispatchEvent(
          new CustomEvent("darkit:hub-changed", { detail: { kitchenId: h.id } }),
        );
        onClose();
      },
    }));

    const actionItems: CommandItem[] = [
      {
        id: "act-inject",
        group: "Quick Actions",
        label: "Simulate Incoming Order (Swiggy / Zomato / Direct)",
        hint: "New Ticket",
        onSelect: () => {
          onClose();
          router.push("/live-orders?action=inject");
        },
      },
      ...(hasPerm("OWNER_VIEW")
        ? [
            {
              id: "act-copilot",
              group: "Quick Actions" as const,
              label: "Open Gemini Operational Copilot",
              hint: "AI Diagnose",
              onSelect: () => {
                onClose();
                router.push("/owner?copilot=1");
              },
            },
            {
              id: "act-tally",
              group: "Quick Actions" as const,
              label: "Download Tally GST Voucher CSV",
              hint: "Export",
              onSelect: () => {
                onClose();
                window.open(
                  "/api/invoices/export?format=tally_csv",
                  "_blank",
                  "noopener,noreferrer",
                );
              },
            },
          ]
        : []),
    ];

    const demoRoleItems: CommandItem[] =
      demoSandboxEnabled && onSwitchDemoRole
        ? DEMO_ROLES.map((r) => ({
            id: `demo-${r.code}`,
            group: "Demo Roles",
            label: `Switch Demo Role → ${r.label}`,
            hint: r.code,
            onSelect: () => {
              onClose();
              onSwitchDemoRole(r.code);
            },
          }))
        : [];

    const all = [
      ...stationItems,
      ...hubItems,
      ...actionItems,
      ...demoRoleItems,
    ];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        (item.hint && item.hint.toLowerCase().includes(q)),
    );
  }, [
    permissions,
    allowedKitchens,
    onSelectHub,
    onClose,
    router,
    query,
    demoSandboxEnabled,
    onSwitchDemoRole,
  ]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (items.length ? (prev + 1) % items.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          items.length ? (prev - 1 + items.length) % items.length : 0,
        );
      } else if (e.key === "Enter" && items[selectedIndex]) {
        e.preventDefault();
        items[selectedIndex].onSelect();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, items, selectedIndex, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[13vh]">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-[3px] transition-opacity"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-white/[0.12] bg-[#151519]"
      >
        <div className="flex items-center border-b border-white/[0.06] px-3.5">
          <span className="text-xs font-medium text-zinc-500">⌘</span>
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to station, switch kitchen hub, or run action..."
            className="w-full bg-transparent px-3 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          <kbd className="rounded border border-white/[0.08] bg-[#1d1d22] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              No matching stations or commands.
            </div>
          ) : (
            items.map((item, idx) => {
              const active = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={item.onSelect}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                    active
                      ? "bg-[#1d1d22] text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                      {item.group}
                    </span>
                    <span className="truncate font-medium">{item.label}</span>
                  </div>
                  {item.hint && (
                    <span className="ml-2 shrink-0 font-mono text-[11px] text-zinc-500">
                      {item.hint}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
