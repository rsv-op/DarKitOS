"use client";

import React, { useCallback, useEffect, useState } from "react";
import type {
  AggregatorChannel,
  AggregatorSkuMapping,
  BrandConfig,
  DbaBrand,
  KitchenConfig,
  MenuItem,
  OutboxEvent,
  WhatsAppNotificationLog,
} from "@/lib/db";

interface IntegrationStatusSummary {
  urbanpiperMode: "LIVE" | "SANDBOX";
  qstashMode: "LIVE" | "LOCAL_SANDBOX";
  whatsappProvider: string;
}

const OUTBOX_STATUS_BADGE: Record<OutboxEvent["status"], string> = {
  DELIVERED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  PENDING: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  RETRYING: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  FAILED: "border-red-500/30 bg-red-500/10 text-red-300",
  DLQ: "border-red-500/40 bg-red-500/20 text-red-200",
};

const WA_STATUS_BADGE: Record<WhatsAppNotificationLog["status"], string> = {
  SENT: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  SANDBOX_LOGGED: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  SKIPPED_COOLDOWN: "border-slate-600 bg-slate-800/80 text-slate-300",
  FAILED: "border-red-500/30 bg-red-500/10 text-red-300",
};

export function IntegrationsPanel() {
  const [activeTab, setActiveTab] = useState<"MAPPINGS" | "OUTBOX" | "WHATSAPP">(
    "MAPPINGS",
  );
  const [mappings, setMappings] = useState<AggregatorSkuMapping[]>([]);
  const [outboxEvents, setOutboxEvents] = useState<OutboxEvent[]>([]);
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppNotificationLog[]>(
    [],
  );
  const [kitchens, setKitchens] = useState<KitchenConfig[]>([]);
  const [brands, setBrands] = useState<BrandConfig[]>([]);
  const [menuCatalog, setMenuCatalog] = useState<MenuItem[]>([]);
  const [status, setStatus] = useState<IntegrationStatusSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Mapping filter & form state
  const [kitchenFilter, setKitchenFilter] = useState("ALL");
  const [formKitchenId, setFormKitchenId] = useState("K1");
  const [formBrandId, setFormBrandId] = useState<DbaBrand>("BurgerForge");
  const [formMenuItemId, setFormMenuItemId] = useState("");
  const [formChannel, setFormChannel] = useState<AggregatorChannel>("ALL");
  const [formExternalStoreId, setFormExternalStoreId] = useState("UP-STORE-GGN-01");
  const [formExternalItemId, setFormExternalItemId] = useState("");

  const loadIntegrations = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/urbanpiper-mappings", {
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 403) {
        setRestricted(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to load integrations.");
      }
      setRestricted(false);
      setMappings(data.mappings ?? []);
      setOutboxEvents(data.outboxEvents ?? []);
      setWhatsappLogs(data.whatsappLogs ?? []);
      setKitchens(data.kitchens ?? []);
      setBrands(data.brands ?? []);
      setMenuCatalog(data.menuCatalog ?? []);
      setStatus(data.integrationStatus ?? null);

      if (data.kitchens?.length > 0) {
        setFormKitchenId((prev) =>
          data.kitchens.some((k: KitchenConfig) => k.id === prev)
            ? prev
            : data.kitchens[0].id,
        );
      }
      if (data.menuCatalog?.length > 0) {
        setFormMenuItemId((prev) => prev || data.menuCatalog[0].id);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load integrations.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIntegrations();
  }, [loadIntegrations]);

  async function handleAddMapping(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const selectedItem = menuCatalog.find((m) => m.id === formMenuItemId);
      const res = await fetch("/api/integrations/urbanpiper-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPSERT_MAPPING",
          kitchenId: formKitchenId,
          brandId: selectedItem?.brandId ?? formBrandId,
          menuItemId: formMenuItemId,
          channel: formChannel,
          externalStoreId: formExternalStoreId.trim(),
          externalItemId: formExternalItemId.trim(),
          active: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to save SKU mapping.");
      setFormExternalItemId("");
      setNotice(
        `Saved UrbanPiper mapping ${data.mapping.externalStoreId} / ${data.mapping.externalItemId} → ${data.mapping.kitchenId} (${data.mapping.menuItemId}).`,
      );
      await loadIntegrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save mapping.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleMapping(mapping: AggregatorSkuMapping) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/integrations/urbanpiper-mappings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: mapping.id,
          active: !mapping.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to update mapping.");
      setNotice(
        `Mapping ${mapping.externalItemId} is now ${!mapping.active ? "ACTIVE" : "INACTIVE"}.`,
      );
      await loadIntegrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFlushOutbox() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/integrations/urbanpiper-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "FLUSH_OUTBOX", limit: 25 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Outbox flush failed.");
      setNotice(
        `Outbox flushed: ${data.processed} processed (${data.delivered} delivered, ${data.retrying} retrying, ${data.failed} failed).`,
      );
      await loadIntegrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Outbox flush failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRetryOutboxEvent(eventId: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/integrations/urbanpiper-mappings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RETRY_OUTBOX",
          eventId,
          flushImmediately: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Retry failed.");
      setNotice(`Outbox event ${eventId} re-queued and flushed.`);
      await loadIntegrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendDailyDigest() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/integrations/urbanpiper-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SEND_DAILY_DIGEST", force: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Daily digest failed.");
      const first = data.results?.[0];
      setNotice(
        first
          ? `Daily INR Digest (${data.istDate} IST) ${first.skipped ? "skipped (cooldown)" : `logged via ${first.log?.provider} [${first.log?.status}]`}.`
          : `Daily INR Digest triggered for ${data.istDate} IST.`,
      );
      await loadIntegrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Daily digest failed.");
    } finally {
      setBusy(false);
    }
  }

  const visibleMappings =
    kitchenFilter === "ALL"
      ? mappings
      : mappings.filter((m) => m.kitchenId === kitchenFilter);

  const pendingOutboxCount = outboxEvents.filter(
    (e) => e.status === "PENDING" || e.status === "RETRYING",
  ).length;
  const failedOutboxCount = outboxEvents.filter(
    (e) => e.status === "FAILED",
  ).length;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="font-mono text-xs font-bold uppercase text-sky-400">
            Sprint 3B • Aggregator, Outbox &amp; WhatsApp Integrations
          </span>
          <h2 className="mt-1 text-lg font-black text-white">
            UrbanPiper Swiggy/Zomato Sync, Durable Outbox &amp; WhatsApp Alerts
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Manage store/item SKU mappings, monitor transactional outbox retries,
            and inspect automated low-stock &amp; daily INR WhatsApp dispatches.
          </p>
        </div>

        {status && (
          <div className="flex flex-wrap gap-2 font-mono text-[10px] font-bold">
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-sky-300">
              UrbanPiper: {status.urbanpiperMode}
            </span>
            <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-indigo-300">
              QStash: {status.qstashMode}
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
              WhatsApp: {status.whatsappProvider}
            </span>
          </div>
        )}
      </div>

      {restricted ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
          Owner access (`OWNER_VIEW`) is required to manage UrbanPiper SKU
          mappings, outbox delivery queues, and WhatsApp notifications.
        </div>
      ) : loading ? (
        <p className="mt-4 font-mono text-xs text-slate-400">
          Loading integration mappings, outbox queue, and WhatsApp logs...
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {notice && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-medium text-emerald-300">
              {notice}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-medium text-red-300">
              {error}
            </div>
          )}

          {/* Sub-tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("MAPPINGS")}
                className={`rounded-xl px-3.5 py-2 font-mono text-xs font-bold transition ${
                  activeTab === "MAPPINGS"
                    ? "bg-sky-500 text-slate-950"
                    : "border border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"
                }`}
              >
                SKU Mappings ({mappings.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("OUTBOX")}
                className={`rounded-xl px-3.5 py-2 font-mono text-xs font-bold transition ${
                  activeTab === "OUTBOX"
                    ? "bg-sky-500 text-slate-950"
                    : "border border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"
                }`}
              >
                Outbox Queue ({pendingOutboxCount} pending
                {failedOutboxCount > 0 ? `, ${failedOutboxCount} failed` : ""})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("WHATSAPP")}
                className={`rounded-xl px-3.5 py-2 font-mono text-xs font-bold transition ${
                  activeTab === "WHATSAPP"
                    ? "bg-sky-500 text-slate-950"
                    : "border border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"
                }`}
              >
                WhatsApp Logs ({whatsappLogs.length})
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleFlushOutbox()}
                className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 font-mono text-xs font-bold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
              >
                Flush Outbox Now
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSendDailyDigest()}
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                Send Daily INR Digest Now
              </button>
            </div>
          </div>

          {activeTab === "MAPPINGS" && (
            <div className="space-y-4">
              <form
                onSubmit={handleAddMapping}
                className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs sm:grid-cols-2 lg:grid-cols-6"
              >
                <label className="block">
                  <span className="font-mono text-[10px] uppercase text-slate-400">
                    Kitchen
                  </span>
                  <select
                    value={formKitchenId}
                    onChange={(e) => {
                      const nextK = e.target.value;
                      setFormKitchenId(nextK);
                      const found = kitchens.find((k) => k.id === nextK);
                      if (found) {
                        setFormExternalStoreId(`UP-STORE-${found.code}`);
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-white"
                  >
                    {kitchens.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.id} ({k.code})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="font-mono text-[10px] uppercase text-slate-400">
                    Menu Item
                  </span>
                  <select
                    value={formMenuItemId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setFormMenuItemId(nextId);
                      const item = menuCatalog.find((m) => m.id === nextId);
                      if (item) setFormBrandId(item.brandId);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-white"
                  >
                    {menuCatalog.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.brandId} · {m.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="font-mono text-[10px] uppercase text-slate-400">
                    Channel
                  </span>
                  <select
                    value={formChannel}
                    onChange={(e) =>
                      setFormChannel(e.target.value as AggregatorChannel)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-white"
                  >
                    <option value="ALL">ALL (Swiggy + Zomato)</option>
                    <option value="SWIGGY">SWIGGY</option>
                    <option value="ZOMATO">ZOMATO</option>
                  </select>
                </label>

                <label className="block">
                  <span className="font-mono text-[10px] uppercase text-slate-400">
                    External Store ID
                  </span>
                  <input
                    type="text"
                    required
                    value={formExternalStoreId}
                    onChange={(e) => setFormExternalStoreId(e.target.value)}
                    placeholder="UP-STORE-GGN-01"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 font-mono text-white"
                  />
                </label>

                <label className="block">
                  <span className="font-mono text-[10px] uppercase text-slate-400">
                    External Item SKU
                  </span>
                  <input
                    type="text"
                    required
                    value={formExternalItemId}
                    onChange={(e) => setFormExternalItemId(e.target.value)}
                    placeholder="UP-SKU-CUSTOM-01"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 font-mono text-white"
                  />
                </label>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-lg bg-sky-500 px-3 py-2 font-mono text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
                  >
                    + Save Mapping
                  </button>
                </div>
              </form>

              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] text-slate-400">
                  Showing {visibleMappings.length} of {mappings.length} active/inactive
                  UrbanPiper SKU mappings ({brands.length} DBA brands).
                </span>
                <select
                  value={kitchenFilter}
                  onChange={(e) => setKitchenFilter(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-white"
                >
                  <option value="ALL">All Kitchens</option>
                  {kitchens.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.id} · {k.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="max-h-72 overflow-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-950 font-mono text-[10px] uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Store ID</th>
                      <th className="px-3 py-2">External SKU</th>
                      <th className="px-3 py-2">Kitchen / Brand</th>
                      <th className="px-3 py-2">Menu Item</th>
                      <th className="px-3 py-2">Channel</th>
                      <th className="px-3 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {visibleMappings.slice(0, 40).map((m) => (
                      <tr key={m.id} className="hover:bg-slate-800/40">
                        <td className="px-3 py-2 font-mono text-slate-300">
                          {m.externalStoreId}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-white">
                          {m.externalItemId}
                        </td>
                        <td className="px-3 py-2 font-mono text-sky-300">
                          {m.kitchenId} · {m.brandId}
                        </td>
                        <td className="px-3 py-2 text-slate-200">
                          {m.externalItemName || m.menuItemId}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-400">
                          {m.channel}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleToggleMapping(m)}
                            className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                              m.active
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                                : "border-slate-600 bg-slate-800 text-slate-400 hover:text-white"
                            }`}
                          >
                            {m.active ? "ACTIVE" : "PAUSED"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "OUTBOX" && (
            <div className="max-h-80 overflow-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-950 font-mono text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Event</th>
                    <th className="px-3 py-2">Order / Aggregate</th>
                    <th className="px-3 py-2">Destination</th>
                    <th className="px-3 py-2">Attempts</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Last Error</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {outboxEvents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-6 text-center text-slate-400"
                      >
                        No outbox events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    outboxEvents.slice(0, 40).map((evt) => (
                      <tr key={evt.id} className="hover:bg-slate-800/40">
                        <td className="px-3 py-2 font-mono font-bold text-white">
                          {evt.eventType}
                        </td>
                        <td className="px-3 py-2 font-mono text-sky-300">
                          {evt.aggregateId}
                          {evt.kitchenId ? ` (${evt.kitchenId})` : ""}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-300">
                          {evt.destination ?? "URBANPIPER"}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-300">
                          {evt.attempt}/{evt.maxAttempts}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${
                              OUTBOX_STATUS_BADGE[evt.status]
                            }`}
                          >
                            {evt.status}
                          </span>
                        </td>
                        <td className="max-w-[220px] truncate px-3 py-2 text-slate-400">
                          {evt.lastError || "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {(evt.status === "FAILED" ||
                            evt.status === "RETRYING") && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleRetryOutboxEvent(evt.id)}
                              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] font-bold text-amber-300 hover:bg-amber-500/20"
                            >
                              Retry
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "WHATSAPP" && (
            <div className="max-h-80 overflow-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-950 font-mono text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Template</th>
                    <th className="px-3 py-2">Recipient</th>
                    <th className="px-3 py-2">Provider</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Summary</th>
                    <th className="px-3 py-2">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {whatsappLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-6 text-center text-slate-400"
                      >
                        No WhatsApp notifications logged yet.
                      </td>
                    </tr>
                  ) : (
                    whatsappLogs.slice(0, 40).map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40">
                        <td className="px-3 py-2 font-mono font-bold text-white">
                          {log.templateName}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-300">
                          {log.recipientPhone}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-400">
                          {log.provider}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${
                              WA_STATUS_BADGE[log.status]
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="max-w-[300px] truncate px-3 py-2 text-slate-300">
                          {typeof log.payload?.formattedSummary === "string"
                            ? log.payload.formattedSummary
                            : log.dedupeKey || log.providerMessageId || "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-slate-400">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
