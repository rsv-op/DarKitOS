"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { SplitInspector } from "@/components/SplitInspector";
import { formatCurrency } from "@/lib/currency";
import {
  type Employee,
  type KitchenConfig,
  type Order,
  type OrderPaymentStatus,
  type Organization,
  type PaymentTransaction,
  type TaxInvoice,
  type TaxInvoiceStatus,
} from "@/lib/db";
import {
  DEFAULT_SAC_RESTAURANT_SERVICE,
  getIndianFinancialYear,
  getIndianStateName,
} from "@/lib/gst";

interface EnrichedInvoice extends TaxInvoice {
  kitchenName?: string;
  kitchenCode?: string;
  brandId?: string;
  channel?: string;
  orderStatus?: string;
  paymentStatus?: OrderPaymentStatus;
}

interface InvoiceSummary {
  totalCount: number;
  issuedCount: number;
  creditNoteCount: number;
  voidedCount: number;
  taxableSubtotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  totalTax: number;
  grandTotal: number;
}

interface InvoiceDetailPayload {
  invoice: TaxInvoice;
  order: Order | null;
  kitchen: KitchenConfig | null;
  organization: Organization | null;
  paymentTransactions: PaymentTransaction[];
}

const INVOICE_STATUS_BADGE: Record<TaxInvoiceStatus, string> = {
  ISSUED: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
  CREDIT_NOTE: "border-amber-500/35 bg-amber-500/10 text-amber-300",
  VOIDED: "border-rose-500/35 bg-rose-500/10 text-rose-300",
};

const PAYMENT_STATUS_BADGE: Record<OrderPaymentStatus, string> = {
  CAPTURED: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
  AGGREGATOR_SETTLED: "border-sky-500/35 bg-sky-500/10 text-sky-300",
  PENDING: "border-amber-500/35 bg-amber-500/10 text-amber-300",
  UNPAID: "border-rose-500/35 bg-rose-500/10 text-rose-300",
  REFUNDED: "border-violet-500/35 bg-violet-500/10 text-violet-300",
};

function formatDate(value?: string): string {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LinkedInvoiceOpener({
  onOpen,
}: {
  onOpen: (targetId: string) => void;
}) {
  const params = useSearchParams();
  const invParam = params.get("invoice") || params.get("order");
  useEffect(() => {
    if (invParam) onOpen(invParam);
  }, [invParam, onOpen]);
  return null;
}

export default function InvoicesPage() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [kitchens, setKitchens] = useState<KitchenConfig[]>([]);
  const [invoices, setInvoices] = useState<EnrichedInvoice[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary>({
    totalCount: 0,
    issuedCount: 0,
    creditNoteCount: 0,
    voidedCount: 0,
    taxableSubtotal: 0,
    cgstTotal: 0,
    sgstTotal: 0,
    igstTotal: 0,
    totalTax: 0,
    grandTotal: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kitchenFilter, setKitchenFilter] = useState("ALL");
  const [fyFilter, setFyFilter] = useState<string>(getIndianFinancialYear());
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [detail, setDetail] = useState<InvoiceDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [gstrPreview, setGstrPreview] = useState<string | null>(null);

  const fmt = useCallback((amount: number) => formatCurrency(amount, "INR"), []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/session", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch("/api/system", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : null,
      ),
    ])
      .then(([sessionData, sysData]) => {
        if (!active) return;
        if (sessionData?.employee) {
          const emp = sessionData.employee as Employee;
          setEmployee(emp);
          if (emp.role !== "OWNER" && emp.kitchenId) {
            setKitchenFilter(emp.kitchenId);
          }
        }
        if (Array.isArray(sysData?.kitchens)) {
          setKitchens(sysData.kitchens as KitchenConfig[]);
        }
      })
      .catch(() => {});

    const onHubChanged = (event: Event) => {
      const custom = event as CustomEvent<{ kitchenId?: string }>;
      if (custom.detail?.kitchenId) setKitchenFilter(custom.detail.kitchenId);
    };
    window.addEventListener("darkit:hub-changed", onHubChanged);
    return () => {
      active = false;
      window.removeEventListener("darkit:hub-changed", onHubChanged);
    };
  }, []);

  const buildQueryString = useCallback(
    (extra?: Record<string, string>) => {
      const qs = new URLSearchParams();
      if (kitchenFilter && kitchenFilter !== "ALL") {
        qs.set("kitchenId", kitchenFilter);
      }
      if (fyFilter && fyFilter !== "ALL") {
        qs.set("financialYear", fyFilter);
      }
      if (statusFilter && statusFilter !== "ALL") {
        qs.set("status", statusFilter);
      }
      if (fromDate) qs.set("from", fromDate);
      if (toDate) qs.set("to", `${toDate}T23:59:59.999Z`);
      if (extra) {
        for (const [k, v] of Object.entries(extra)) {
          qs.set(k, v);
        }
      }
      return qs.toString();
    },
    [kitchenFilter, fyFilter, statusFilter, fromDate, toDate],
  );

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = buildQueryString();
      const res = await fetch(`/api/invoices${qs ? `?${qs}` : ""}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to load GST tax invoices");
      }
      setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
      if (data.summary) setSummary(data.summary);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load GST invoices",
      );
    } finally {
      setLoading(false);
    }
  }, [buildQueryString]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  const openInvoiceDetail = useCallback(async (idOrOrderId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(
        `/api/invoices/${encodeURIComponent(idOrOrderId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as InvoiceDetailPayload;
      setDetail(data);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleLoadGstrSummary = useCallback(async () => {
    const qs = buildQueryString({ format: "gst_summary_json" });
    const res = await fetch(`/api/invoices/export?${qs}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = await res.json();
    setGstrPreview(JSON.stringify(data, null, 2));
  }, [buildQueryString]);

  const fyOptions = useMemo(() => {
    const set = new Set<string>([
      getIndianFinancialYear(),
      "FY26-27",
      "FY27-28",
    ]);
    for (const inv of invoices) set.add(inv.financialYear);
    return Array.from(set).sort().reverse();
  }, [invoices]);

  const isOwner = employee?.role === "OWNER";

  return (
    <AppShell
      title="GST & Tally"
      subtitle={`SAC ${DEFAULT_SAC_RESTAURANT_SERVICE} · ${fyFilter === "ALL" ? "All FYs" : fyFilter}`}
      activeHub={kitchenFilter}
      onHubChange={setKitchenFilter}
      rightActions={
        <>
          <a
            href={`/api/invoices/export?${buildQueryString({ format: "tally_csv" })}`}
            className="inline-flex h-7 items-center rounded-md bg-emerald-500 px-2.5 text-[11px] font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
          >
            Export Tally CSV
          </a>
          <a
            href={`/api/invoices/export?${buildQueryString({ format: "zoho_csv" })}`}
            className="inline-flex h-7 items-center rounded-md border border-sky-500/40 bg-sky-500/15 px-2.5 text-[11px] font-semibold text-sky-200 transition-colors hover:bg-sky-500/25"
          >
            Export Zoho CSV
          </a>
          <button
            type="button"
            onClick={() => void handleLoadGstrSummary()}
            className="inline-flex h-7 items-center rounded-md border border-white/[0.08] bg-[#151519] px-2.5 text-[11px] font-medium text-zinc-300 hover:border-white/[0.16] hover:text-zinc-100"
          >
            GSTR-1 JSON
          </button>
        </>
      }
    >
      <Suspense fallback={null}>
        <LinkedInvoiceOpener onOpen={openInvoiceDetail} />
      </Suspense>

      <div className="space-y-5">
        {/* Hairline GST KPI Strip */}
        <section className="grid grid-cols-2 divide-y divide-white/[0.06] overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519] sm:grid-cols-5 sm:divide-x sm:divide-y-0">
          <div className="px-4 py-3">
            <p className="text-[11px] font-medium text-zinc-400">Net Taxable</p>
            <p className="mt-1 font-mono text-lg font-semibold text-zinc-100 tabular-nums">
              {fmt(summary.taxableSubtotal)}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500 tabular-nums">
              {summary.issuedCount} issued · {summary.creditNoteCount} CN
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] font-medium text-zinc-400">
              CGST + SGST
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-emerald-300 tabular-nums">
              {fmt(summary.cgstTotal + summary.sgstTotal)}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-zinc-500 tabular-nums">
              {fmt(summary.cgstTotal)} / {fmt(summary.sgstTotal)}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] font-medium text-zinc-400">
              IGST (Inter-State)
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-cyan-300 tabular-nums">
              {fmt(summary.igstTotal)}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500">5% Restaurant</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] font-medium text-zinc-400">
              GST Liability
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-amber-300 tabular-nums">
              {fmt(summary.totalTax)}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500">Net of credits</p>
          </div>
          <div className="col-span-2 px-4 py-3 sm:col-span-1">
            <p className="text-[11px] font-medium text-zinc-400">
              Net Invoice Total
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-zinc-100 tabular-nums">
              {fmt(summary.grandTotal)}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
              {fyFilter === "ALL" ? "All FYs" : fyFilter}
            </p>
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
            {error}
          </div>
        )}

        {gstrPreview && (
          <section className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#151519]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
              <span className="font-mono text-[11px] font-semibold text-zinc-200">
                GSTR-1 Structured Summary JSON
              </span>
              <button
                type="button"
                onClick={() => setGstrPreview(null)}
                className="text-xs text-zinc-400 hover:text-zinc-100"
              >
                Close
              </button>
            </div>
            <pre className="max-h-60 overflow-auto bg-[#09090b] p-3.5 font-mono text-[11px] text-emerald-300">
              {gstrPreview}
            </pre>
          </section>
        )}

        {/* Invoices Table + Inline Filters */}
        <section className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519]/60">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-[#09090b]/40 px-4 py-2.5">
            <select
              aria-label="Filter hub"
              value={kitchenFilter}
              disabled={!isOwner && Boolean(employee?.kitchenId)}
              onChange={(e) => setKitchenFilter(e.target.value)}
              className="h-7 rounded-md border border-white/[0.08] bg-[#151519] px-2 text-[11px] text-zinc-200 disabled:opacity-60"
            >
              {isOwner && <option value="ALL">All Hubs</option>}
              {kitchens.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.id} · {k.code}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter FY"
              value={fyFilter}
              onChange={(e) => setFyFilter(e.target.value)}
              className="h-7 rounded-md border border-white/[0.08] bg-[#151519] px-2 text-[11px] text-zinc-200"
            >
              <option value="ALL">All FYs</option>
              {fyOptions.map((fy) => (
                <option key={fy} value={fy}>
                  {fy}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-7 rounded-md border border-white/[0.08] bg-[#151519] px-2 text-[11px] text-zinc-200"
            >
              <option value="ALL">All Statuses</option>
              <option value="ISSUED">ISSUED</option>
              <option value="CREDIT_NOTE">CREDIT_NOTE</option>
              <option value="VOIDED">VOIDED</option>
            </select>

            <input
              type="date"
              aria-label="From date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-7 rounded-md border border-white/[0.08] bg-[#151519] px-2 font-mono text-[11px] text-zinc-200"
            />
            <input
              type="date"
              aria-label="To date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-7 rounded-md border border-white/[0.08] bg-[#151519] px-2 font-mono text-[11px] text-zinc-200"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] bg-[#09090b]/40 text-[11px] font-medium text-zinc-500">
                  <th className="px-4 py-2">Invoice #</th>
                  <th className="px-4 py-2">Issued</th>
                  <th className="px-4 py-2">Order / Hub</th>
                  <th className="px-4 py-2">Supply</th>
                  <th className="px-4 py-2 text-right">Taxable</th>
                  <th className="px-4 py-2 text-right">CGST / SGST</th>
                  <th className="px-4 py-2 text-right">IGST</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2">Payment</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {loading ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-10 text-center text-xs text-zinc-500"
                    >
                      Loading sequential GST tax invoices...
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-10 text-center text-xs text-zinc-500"
                    >
                      No GST tax invoices match the selected filters.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      onClick={() => void openInvoiceDetail(inv.id)}
                      className="cursor-pointer transition-colors hover:bg-[#1d1d22]/60"
                    >
                      <td className="px-4 py-2.5 font-mono font-medium text-zinc-100 tabular-nums">
                        {inv.invoiceNumber}
                        <span className="block text-[10px] font-normal text-zinc-500">
                          {inv.sellerGstin}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-400 tabular-nums">
                        {formatDate(inv.issuedAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono font-medium text-zinc-200 tabular-nums">
                          {inv.orderId}
                        </span>
                        <span className="block text-[11px] text-zinc-500">
                          {inv.kitchenId} · {inv.channel || "Channel"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-400 tabular-nums">
                        {inv.sellerStateCode} → {inv.placeOfSupplyStateCode}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-zinc-200 tabular-nums">
                        {fmt(inv.taxableSubtotal)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-emerald-300 tabular-nums">
                        {inv.igstAmount > 0
                          ? "—"
                          : `${fmt(inv.cgstAmount)} / ${fmt(inv.sgstAmount)}`}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-cyan-300 tabular-nums">
                        {inv.igstAmount > 0 ? fmt(inv.igstAmount) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-zinc-100 tabular-nums">
                        {fmt(inv.grandTotal)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-block rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium ${
                            PAYMENT_STATUS_BADGE[
                              inv.paymentStatus ?? "AGGREGATOR_SETTLED"
                            ]
                          }`}
                        >
                          {(inv.paymentStatus ?? "AGGREGATOR_SETTLED").replaceAll(
                            "_",
                            " ",
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-block rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium ${INVOICE_STATUS_BADGE[inv.status]}`}
                        >
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* GST Tax Invoice Slide-Over Inspector */}
      <SplitInspector
        open={Boolean(detail || detailLoading)}
        mode="overlay"
        widthClassName="max-w-[580px]"
        title={
          detail ? detail.invoice.invoiceNumber : "Loading Tax Invoice..."
        }
        subtitle={
          detail
            ? `${detail.organization?.name || "DarKit Hospitality Pvt. Ltd."} · ${detail.kitchen?.name || detail.invoice.kitchenId}`
            : undefined
        }
        badge={
          detail ? (
            <span
              className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium ${INVOICE_STATUS_BADGE[detail.invoice.status]}`}
            >
              {detail.invoice.status}
            </span>
          ) : undefined
        }
        onClose={() => setDetail(null)}
        footer={
          detail ? (
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/live-orders?order=${encodeURIComponent(detail.invoice.orderId)}`}
                className="text-xs font-medium text-zinc-300 hover:text-white"
              >
                Open Order {detail.invoice.orderId} →
              </Link>
              <button
                type="button"
                onClick={() => window.print()}
                className="h-8 rounded-md bg-zinc-100 px-3 text-xs font-semibold text-zinc-950 hover:bg-white"
              >
                Print / Save PDF
              </button>
            </div>
          ) : undefined
        }
      >
        {detailLoading || !detail ? (
          <p className="py-12 text-center text-xs text-zinc-500">
            Loading Indian GST Tax Invoice...
          </p>
        ) : (
          <div className="space-y-4 text-xs">
            {detail.invoice.status === "CREDIT_NOTE" && (
              <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-amber-200">
                <p className="font-semibold">GST Credit Note Issued</p>
                <p className="mt-0.5 text-[11px]">
                  Credited {formatDate(detail.invoice.voidedAt)} ·{" "}
                  {detail.invoice.voidReason || "Cancelled before prep"}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.06] font-mono text-[11px]">
              <div className="bg-[#151519] p-2.5">
                <p className="text-[10px] text-zinc-500">Seller GSTIN</p>
                <p className="mt-0.5 font-semibold text-zinc-100">
                  {detail.invoice.sellerGstin}
                </p>
              </div>
              <div className="bg-[#151519] p-2.5">
                <p className="text-[10px] text-zinc-500">FSSAI License</p>
                <p className="mt-0.5 font-semibold text-zinc-100">
                  {detail.invoice.sellerFssai}
                </p>
              </div>
              <div className="bg-[#151519] p-2.5">
                <p className="text-[10px] text-zinc-500">Supply States</p>
                <p className="mt-0.5 text-zinc-200">
                  {detail.invoice.sellerStateCode} (
                  {getIndianStateName(detail.invoice.sellerStateCode)}) →{" "}
                  {detail.invoice.placeOfSupplyStateCode} (
                  {getIndianStateName(detail.invoice.placeOfSupplyStateCode)})
                </p>
              </div>
              <div className="bg-[#151519] p-2.5">
                <p className="text-[10px] text-zinc-500">Customer</p>
                <p className="mt-0.5 text-zinc-200">
                  {detail.invoice.customerName || "Walk-In Guest"}
                </p>
              </div>
            </div>

            {detail.order && (
              <div className="overflow-hidden rounded-lg border border-white/[0.06]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.06] bg-[#151519] text-[10px] font-medium uppercase text-zinc-500">
                    <tr>
                      <th className="px-3 py-2">Item (SAC 996331)</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] bg-[#0e0e11]">
                    {detail.order.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 text-zinc-200">{item.name}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {item.quantity}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {fmt(item.price ?? 0)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-medium text-zinc-100 tabular-nums">
                          {fmt((item.price ?? 0) * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="space-y-1.5 rounded-lg border border-white/[0.06] bg-[#151519] p-3 font-mono text-[11px] tabular-nums">
              <div className="flex justify-between text-zinc-300">
                <span>
                  Taxable Value (incl. packaging {fmt(detail.invoice.packagingFee)})
                </span>
                <span>{fmt(detail.invoice.taxableSubtotal)}</span>
              </div>
              {detail.invoice.igstAmount > 0 ? (
                <div className="flex justify-between text-cyan-300">
                  <span>IGST ({detail.invoice.igstRate}%)</span>
                  <span>{fmt(detail.invoice.igstAmount)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-emerald-300">
                    <span>CGST ({detail.invoice.cgstRate}%)</span>
                    <span>{fmt(detail.invoice.cgstAmount)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-300">
                    <span>SGST ({detail.invoice.sgstRate}%)</span>
                    <span>{fmt(detail.invoice.sgstAmount)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t border-white/[0.06] pt-2 text-xs font-semibold text-zinc-100">
                <span>Grand Total (INR)</span>
                <span>{fmt(detail.invoice.grandTotal)}</span>
              </div>
            </div>

            {detail.paymentTransactions.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519]">
                <div className="border-b border-white/[0.06] px-3 py-2 text-[11px] font-medium text-zinc-400">
                  Payment Transactions
                </div>
                <div className="divide-y divide-white/[0.06]">
                  {detail.paymentTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 font-mono text-[11px]"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-100">
                          {tx.provider} · {tx.status}
                        </p>
                        <p className="truncate text-[10px] text-zinc-500">
                          {tx.providerPaymentId || tx.providerOrderId || "--"}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold text-emerald-300 tabular-nums">
                        {fmt(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SplitInspector>
    </AppShell>
  );
}
