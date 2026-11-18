"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import AppShell from "@/components/AppShell";
import type { SystemSettings } from "@/lib/db";

export default function SettingsPage() {
  const [settings, setSettings] =
    useState<SystemSettings>({
      currency: "USD",
      timezone: "Asia/Kolkata",
      theme: "obsidian",
      fluidAnimations: true,
      syncMode: "WEBSOCKET",
      autoAcceptOrders: true,
      lowStockMultiplier: 1.0,
      prepSlaMinutes: 12,
      dispatchSlaMinutes: 15,
      rlsEnforcement: "STRICT_LOCAL_TX",
      circuitBreakerState: "CLOSED",
      rateLimitRps: 250,
    });
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/system", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function saveSettings(
    partial: Partial<SystemSettings>,
  ) {
    setSaving(true);
    setNotice("");
    try {
      const next = { ...settings, ...partial };
      setSettings(next);
      const res = await fetch("/api/system", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "UPDATE_SETTINGS",
          settings: next,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setNotice(
          "System configuration persisted to canonical store and emitted to OS Shell.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Settings"
      subtitle="Adjust the workspace appearance, regional preferences, and kitchen timing targets."
    >
      <div className="space-y-6">
        {notice && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 font-mono text-xs text-emerald-300">
            ✓ {notice}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 1. OS Theme & Fluidic Personalization */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <span className="font-mono text-xs font-bold uppercase text-sky-400">
              Live-Preview OS Theme Engine
            </span>
            <h2 className="mt-1 text-lg font-black text-white">
              Desktop & Workspace Personalization
            </h2>
            <p className="text-xs text-slate-400">
              Changes emit global state updates that update the OS Shell without hard refreshes.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {(
                [
                  {
                    id: "obsidian",
                    label: "Obsidian Dark",
                    desc: "High-contrast deep carbon",
                  },
                  {
                    id: "midnight",
                    label: "Midnight Cobalt",
                    desc: "Deep sapphire command center",
                  },
                  {
                    id: "cyber-emerald",
                    label: "Cyber Emerald",
                    desc: "Matrix green operations",
                  },
                  {
                    id: "titanium",
                    label: "Titanium Slate",
                    desc: "Industrial neutral slate",
                  },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void saveSettings({
                      theme: t.id,
                    })
                  }
                  className={`rounded-xl border p-3.5 text-left transition ${
                    settings.theme === t.id
                      ? "border-sky-500 bg-sky-500/15 text-white"
                      : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <p className="font-mono text-xs font-bold">
                    {t.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {t.desc}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {/* 2. Business & Order SLA Rules */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <span className="font-mono text-xs font-bold uppercase text-emerald-400">
              Business & Kitchen SLA Rules
            </span>
            <h2 className="mt-1 text-lg font-black text-white">
              Currency, Timezone & KDS Synchronization
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-slate-400">
                  Reporting Currency
                </span>
                <select
                  value={settings.currency}
                  onChange={(e) =>
                    void saveSettings({
                      currency: e.target
                        .value as SystemSettings["currency"],
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
                >
                  <option value="USD">
                    USD ($)
                  </option>
                  <option value="INR">
                    INR (₹)
                  </option>
                  <option value="EUR">
                    EUR (€)
                  </option>
                </select>
              </label>

              <label className="block">
                <span className="font-mono text-[10px] uppercase text-slate-400">
                  Default KDS Sync Transport
                </span>
                <select
                  value={settings.syncMode}
                  onChange={(e) =>
                    void saveSettings({
                      syncMode: e.target
                        .value as SystemSettings["syncMode"],
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
                >
                  <option value="WEBSOCKET">
                    WebSocket Full-Duplex
                  </option>
                  <option value="SSE">
                    Server-Sent Events (SSE)
                  </option>
                  <option value="HTTP_POLLING">
                    HTTP Long-Polling Fallback
                  </option>
                </select>
              </label>

              <label className="block">
                <span className="font-mono text-[10px] uppercase text-slate-400">
                  Prep SLA Target (Minutes)
                </span>
                <input
                  type="number"
                  min={3}
                  max={60}
                  value={
                    settings.prepSlaMinutes
                  }
                  onChange={(e) =>
                    void saveSettings({
                      prepSlaMinutes: Number(
                        e.target.value,
                      ),
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-white"
                />
              </label>

              <label className="block">
                <span className="font-mono text-[10px] uppercase text-slate-400">
                  Dispatch SLA Target (Minutes)
                </span>
                <input
                  type="number"
                  min={3}
                  max={60}
                  value={
                    settings.dispatchSlaMinutes
                  }
                  onChange={(e) =>
                    void saveSettings({
                      dispatchSlaMinutes:
                        Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-white"
                />
              </label>
            </div>
          </section>
        </div>

        {/* 3. Cloud7 Security & Self-Healing Config Verification */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="font-mono text-xs font-bold uppercase text-amber-400">
                Self-Healing Configuration & Cloud7 Security
              </span>
              <h2 className="mt-1 text-lg font-black text-white">
                Resilience Against Malformed Configuration Payloads
              </h2>
              <p className="text-xs text-slate-400">
                If malformed or out-of-range configuration values (such as NaN or negative SLA thresholds) are submitted, the store sanitizer automatically falls back to safe operational parameters.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void saveSettings({
                  prepSlaMinutes: -999,
                  lowStockMultiplier:
                    Number.NaN,
                })
              }
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 font-mono text-xs font-bold text-amber-300 hover:bg-amber-500/20"
            >
              ⚡ Test Self-Healing Config Sanitizer
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
