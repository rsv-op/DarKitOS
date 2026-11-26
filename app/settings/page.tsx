"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import AppShell from "@/components/AppShell";
import { IntegrationsPanel } from "@/components/IntegrationsPanel";
import type { SystemSettings } from "@/lib/db";

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    currency: "INR",
    timezone: "Asia/Kolkata",
    theme: "obsidian",
    fluidAnimations: true,
    syncMode: "HTTP_POLLING",
    autoAcceptOrders: true,
    lowStockMultiplier: 1.0,
    prepSlaMinutes: 12,
    dispatchSlaMinutes: 15,
    rlsEnforcement: "STRICT_LOCAL_TX",
    circuitBreakerState: "CLOSED",
    rateLimitRps: 250,
  });
  const [prepInput, setPrepInput] = useState<string>("12");
  const [dispatchInput, setDispatchInput] = useState<string>("15");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/system", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to load settings.");
        return;
      }
      if (data.settings) {
        setSettings(data.settings);
        setPrepInput(String(data.settings.prepSlaMinutes));
        setDispatchInput(String(data.settings.dispatchSlaMinutes));
      }
      setError("");
    } catch {
      setError("Network error while loading settings.");
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function saveSettings(partial: Partial<SystemSettings>) {
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const next = { ...settings, ...partial };
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
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to save settings.");
        return;
      }
      setSettings(data.settings);
      setPrepInput(String(data.settings.prepSlaMinutes));
      setDispatchInput(String(data.settings.dispatchSlaMinutes));
      window.dispatchEvent(
        new CustomEvent("darkit:settings-updated", { detail: data.settings }),
      );
      setNotice(
        "Preferences saved and applied live across the workspace.",
      );
    } catch {
      setError("Network error while saving settings.");
    } finally {
      setSaving(false);
    }
  }

  function handleSaveSlaTargets(e: React.FormEvent) {
    e.preventDefault();
    void saveSettings({
      prepSlaMinutes: Number(prepInput),
      dispatchSlaMinutes: Number(dispatchInput),
    });
  }

  return (
    <AppShell
      title="Settings"
      subtitle="Adjust currency reporting (INR default), workspace appearance, and kitchen timing targets."
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-300">
            ⚠ {error}
          </div>
        )}

        {notice && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 font-mono text-xs text-emerald-300">
            ✓ {notice}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 1. Workspace Theme */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <span className="font-mono text-xs font-bold uppercase text-sky-400">
              Live-Preview Workspace Theme
            </span>
            <h2 className="mt-1 text-lg font-black text-white">
              Workspace Personalization
            </h2>
            <p className="text-xs text-slate-400">
              Updates the workspace shell live without a page refresh.
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
                    desc: "Emerald green operations",
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
                  onClick={() => void saveSettings({ theme: t.id })}
                  className={`rounded-xl border p-3.5 text-left transition ${
                    settings.theme === t.id
                      ? "border-sky-500 bg-sky-500/15 text-white"
                      : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <p className="font-mono text-xs font-bold">{t.label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{t.desc}</p>
                </button>
              ))}
            </div>
          </section>

          {/* 2. Business & Order SLA Rules */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <span className="font-mono text-xs font-bold uppercase text-emerald-400">
              Business &amp; Kitchen SLA Rules
            </span>
            <h2 className="mt-1 text-lg font-black text-white">
              Currency, Sync &amp; Prep Targets
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-slate-400">
                  Reporting Currency
                </span>
                <select
                  value={settings.currency}
                  disabled={saving}
                  onChange={(e) =>
                    void saveSettings({
                      currency: e.target
                        .value as SystemSettings["currency"],
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
                >
                  <option value="INR">INR (₹) — Indian Rupee</option>
                  <option value="USD">USD ($) — US Dollar</option>
                  <option value="EUR">EUR (€) — Euro</option>
                </select>
              </label>

              <label className="block">
                <span className="font-mono text-[10px] uppercase text-slate-400">
                  KDS Sync Transport
                </span>
                <select
                  value={settings.syncMode}
                  disabled={saving}
                  onChange={(e) =>
                    void saveSettings({
                      syncMode: e.target
                        .value as SystemSettings["syncMode"],
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
                >
                  <option value="HTTP_POLLING">
                    HTTP Polling (Sprint 0 Active)
                  </option>
                  <option value="SSE">
                    Server-Sent Events (Sprint 2 Target)
                  </option>
                  <option value="WEBSOCKET">
                    Supabase Realtime WebSocket (Sprint 2 Target)
                  </option>
                </select>
              </label>
            </div>

            <form
              onSubmit={handleSaveSlaTargets}
              className="mt-4 grid grid-cols-2 gap-4 text-xs items-end"
            >
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-slate-400">
                  Prep SLA Target (Minutes)
                </span>
                <input
                  type="number"
                  min={3}
                  max={60}
                  value={prepInput}
                  onChange={(e) => setPrepInput(e.target.value)}
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
                  value={dispatchInput}
                  onChange={(e) => setDispatchInput(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-white"
                />
              </label>

              <div className="col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save SLA Targets"}
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* 3. Aggregator, Outbox & WhatsApp Integrations (Sprint 3B) */}
        <IntegrationsPanel />

        {/* 4. Safe Configuration Sanitizer */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="font-mono text-xs font-bold uppercase text-amber-400">
                Configuration Validation &amp; Safe Fallback
              </span>
              <h2 className="mt-1 text-lg font-black text-white">
                Resilience Against Malformed SLA Payloads
              </h2>
              <p className="text-xs text-slate-400">
                Out-of-range or NaN configuration payloads are rejected by the
                store sanitizer, preserving the last valid operational settings.
              </p>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void saveSettings({
                  prepSlaMinutes: -999,
                  lowStockMultiplier: Number.NaN,
                })
              }
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 font-mono text-xs font-bold text-amber-300 hover:bg-amber-500/20"
            >
              ⚡ Test Safe Config Fallback
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
