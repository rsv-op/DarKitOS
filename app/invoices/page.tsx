"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
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
  ISSUED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  CREDIT_NOTE: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  VOIDED: "border-red-500/40 bg-red-500/10 text-red-300",
};

const PAYMENT_STATUS_BADGE: Record<OrderPaymentStatus, string> = {
  CAPTURED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  AGGREGATOR_SETTLED: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  PENDING: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  UNPAID: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  REFUNDED: "border-purple-500/40 bg-purple-500/10 text-purple-300",
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
      .catch(() => {
        // ignore transient metadata error
      });
    return () => {
      active = false;
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
    const set = new Set<string>([getIndianFinancialYear(), "FY26-27", "FY27-28"]);
    for (const inv of invoices) set.add(inv.financialYear);
    return Array.from(set).sort().reverse();
  }, [invoices]);

  const isOwner = employee?.role === "OWNER";

  return (
    <AppShell
      title="GST Tax Invoices & Accounting Exports"
      subtitle="Indian GST (CGST/SGST/IGST), gapless per-hub FY sequencing, credit notes, Tally Prime & Zoho Books exports, and Razorpay settlement status."
    >
      <Suspense fallback={null}>
        <LinkedInvoiceOpener onOpen={openInvoiceDetail} />
      </Suspense>

      <div className="space-y-6">
        {/* KPI Strip */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <span className="font-mono text-[11px] font-bold uppercase text-slate-400">
              Net Taxable Value
            </span>
            <p className="mt-1 font-mono text-xl font-black text-white">
              {fmt(summary.taxableSubtotal)}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-400">
              {summary.issuedCount} issued • {summary.creditNoteCount} credit notes
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <span className="font-mono text-[11px] font-bold uppercase text-emerald-400">
              CGST + SGST (Intra)
            </span>
            <p className="mt-1 font-mono text-xl font-black text-emerald-300">
              {fmt(summary.cgstTotal + summary.sgstTotal)}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-400">
              CGST {fmt(summary.cgstTotal)} • SGST {fmt(summary.sgstTotal)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <span className="font-mono text-[11px] font-bold uppercase text-cyan-400">
              IGST (Inter-State)
            </span>
            <p className="mt-1 font-mono text-xl font-black text-cyan-300">
              {fmt(summary.igstTotal)}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-400">
              SAC {DEFAULT_SAC_RESTAURANT_SERVICE} (5% Restaurant)
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <span className="font-mono text-[11px] font-bold uppercase text-amber-400">
              Total GST Liability
            </span>
            <p className="mt-1 font-mono text-xl font-black text-amber-300">
              {fmt(summary.totalTax)}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-400">
              Excludes credited / voided bills
            </p>
          </div>
          <div className="col-span-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 lg:col-span-1">
            <span className="font-mono text-[11px] font-bold uppercase text-emerald-300">
              Net Invoice Total
            </span>
            <p className="mt-1 font-mono text-xl font-black text-white">
              {fmt(summary.grandTotal)}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-emerald-300/80">
              FY {fyFilter === "ALL" ? "All Years" : fyFilter}
            </p>
          </div>
        </section>

        {/* Filters & Accounting Export Toolbar */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <label className="block">
                <span className="mb-1 block font-mono text-[10px] font-bold uppercase text-slate-400">
                  Kitchen Hub
                </span>
                <select
                  value={kitchenFilter}
                  disabled={!isOwner && Boolean(employee?.kitchenId)}
                  onChange={(e) => setKitchenFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-70"
                >
                  {isOwner && <option value="ALL">All Organization Hubs</option>}
                  {kitchens.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.id} • {k.code} ({getIndianStateName(k.stateCode)})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block font-mono text-[10px] font-bold uppercase text-slate-400">
                  Financial Year
                </span>
                <select
                  value={fyFilter}
                  onChange={(e) => setFyFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  <option value="ALL">All FYs</option>
                  {fyOptions.map((fy) => (
                    <option key={fy} value={fy}>
                      {fy}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block font-mono text-[10px] font-bold uppercase text-slate-400">
                  Invoice Status
                </span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ISSUED">ISSUED (Tax Invoice)</option>
                  <option value="CREDIT_NOTE">CREDIT_NOTE</option>
                  <option value="VOIDED">VOIDED</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block font-mono text-[10px] font-bold uppercase text-slate-400">
                  From Date
                </span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </label>

              <label className="block">
                <span className="mb-1 block font-mono text-[10px] font-bold uppercase text-slate-400">
                  To Date
                </span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/api/invoices/export?${buildQueryString({ format: "tally_csv" })}`}
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 font-mono text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20"
              >
                ↓ Export Tally CSV
              </a>
              <a
                href={`/api/invoices/export?${buildQueryString({ format: "zoho_csv" })}`}
                className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-3.5 py-2 font-mono text-xs font-bold text-sky-300 transition hover:bg-sky-500/20"
              >
                ↓ Export Zoho Books CSV
              </a>
              <button
                type="button"
                onClick={() => void handleLoadGstrSummary()}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 font-mono text-xs font-bold text-slate-200 transition hover:border-slate-500"
              >
                GSTR-1 JSON
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 font-mono text-xs text-red-300">
            {error}
          </div>
        )}

        {gstrPreview && (
          <section className="rounded-2xl border border-sky-500/30 bg-slate-950 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs font-bold uppercase text-sky-400">
                GSTR-1 Structured Summary JSON Preview
              </span>
              <button
                type="button"
                onClick={() => setGstrPreview(null)}
                className="font-mono text-xs text-slate-400 hover:text-white"
              >
                Close ✕
              </button>
            </div>
            <pre className="max-h-64 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-[11px] text-emerald-300">
              {gstrPreview}
            </pre>
          </section>
        )}

        {/* Invoices Table */}
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Invoice Number</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Order / Hub</th>
                  <th className="px-4 py-3">Supply State</th>
                  <th className="px-4 py-3 text-right">Taxable</th>
                  <th className="px-4 py-3 text-right">CGST / SGST</th>
                  <th className="px-4 py-3 text-right">IGST</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {loading ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-10 text-center font-mono text-slate-400"
                    >
                      Loading sequential GST tax invoices…
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-10 text-center font-mono text-slate-400"
                    >
                      No GST tax invoices match the selected filters.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      onClick={() => void openInvoiceDetail(inv.id)}
                      className="cursor-pointer transition hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-white">
                        {inv.invoiceNumber}
                        <span className="block text-[10px] font-normal text-slate-400">
                          GSTIN: {inv.sellerGstin}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-300">
                        {formatDate(inv.issuedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-sky-300">
                          {inv.orderId}
                        </span>
                        <span className="block text-[11px] text-slate-400">
                          {inv.kitchenId} • {inv.brandId || "Brand"} ({inv.channel || "Channel"})
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-300">
                        {inv.sellerStateCode} → {inv.placeOfSupplyStateCode}
                        <span className="block text-[10px] text-slate-400">
                          {inv.igstAmount > 0 ? "Inter-State" : "Intra-State"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-200">
                        {fmt(inv.taxableSubtotal)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-300">
                        {inv.igstAmount > 0
                          ? "—"
                          : `${fmt(inv.cgstAmount)} / ${fmt(inv.sgstAmount)}`}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-cyan-300">
                        {inv.igstAmount > 0 ? fmt(inv.igstAmount) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-white">
                        {fmt(inv.grandTotal)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${
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
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${INVOICE_STATUS_BADGE[inv.status]}`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void openInvoiceDetail(inv.id);
                          }}
                          className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono text-[11px] font-bold text-sky-300 hover:border-sky-500"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Indian GST Tax Invoice Print-Ready Preview Modal */}
        {(detail || detailLoading) && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
            onClick={() => setDetail(null)}
          >
            <div
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {detailLoading || !detail ? (
                <p className="py-12 text-center font-mono text-xs text-slate-400">
                  Loading Indian GST Tax Invoice…
                </p>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                        {detail.invoice.status === "CREDIT_NOTE"
                          ? "GST Credit Note (Pre-Prep Cancellation)"
                          : "Indian GST Tax Invoice (SAC 996331)"}
                      </span>
                      <h2 className="mt-1 font-mono text-2xl font-black text-white">
                        {detail.invoice.invoiceNumber}
                      </h2>
                      <p className="mt-1 text-xs text-slate-300">
                        {detail.organization?.name ||
                          "DarKit Hospitality Pvt. Ltd."}{" "}
                        • {detail.kitchen?.name || detail.invoice.kitchenId}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs font-bold text-emerald-300 hover:bg-emerald-500/20"
                      >
                        Print / PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetail(null)}
                        className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-300 hover:text-white"
                      >
                        Close ✕
                      </button>
                    </div>
                  </div>

                  {detail.invoice.status === "CREDIT_NOTE" && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 font-mono text-xs text-amber-200">
                      <strong>CREDIT NOTE ISSUED:</strong> Credited on{" "}
                      {formatDate(detail.invoice.voidedAt)}. Reason:{" "}
                      {detail.invoice.voidReason || "Cancelled before prep"}.
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs">
                    <div>
                      <span className="text-slate-500">Seller GSTIN</span>
                      <p className="font-bold text-white">
                        {detail.invoice.sellerGstin}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">FSSAI License No.</span>
                      <p className="font-bold text-white">
                        {detail.invoice.sellerFssai}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">
                        Seller State → Place of Supply
                      </span>
                      <p className="font-bold text-sky-300">
                        {detail.invoice.sellerStateCode} (
                        {getIndianStateName(detail.invoice.sellerStateCode)}) →{" "}
                        {detail.invoice.placeOfSupplyStateCode} (
                        {getIndianStateName(
                          detail.invoice.placeOfSupplyStateCode,
                        )}
                        )
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Customer / Order</span>
                      <p className="font-bold text-white">
                        {detail.invoice.customerName || "Walk-In Guest"} •{" "}
                        <Link
                          href={`/live-orders?order=${encodeURIComponent(detail.invoice.orderId)}`}
                          className="text-sky-400 underline"
                        >
                          {detail.invoice.orderId}
                        </Link>
                      </p>
                    </div>
                  </div>

                  {detail.order && (
                    <div className="overflow-hidden rounded-xl border border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 font-mono text-[10px] uppercase text-slate-400">
                          <tr>
                            <th className="px-3 py-2">Item (SAC 996331)</th>
                            <th className="px-3 py-2 text-right">Qty</th>
                            <th className="px-3 py-2 text-right">Rate</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {detail.order.items.map((item) => (
                            <tr key={item.id}>
                              <td className="px-3 py-2 text-slate-200">
                                {item.name}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {item.quantity}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {fmt(item.price ?? 0)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-white">
                                {fmt((item.price ?? 0) * item.quantity)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* GST Tax Breakup */}
                  <div className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Taxable Value (incl. packaging {fmt(detail.invoice.packagingFee)})</span>
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
                    <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-black text-white">
                      <span>Grand Total (INR)</span>
                      <span>{fmt(detail.invoice.grandTotal)}</span>
                    </div>
                  </div>

                  {/* Payment Ledger */}
                  {detail.paymentTransactions.length > 0 && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs">
                      <span className="font-bold uppercase text-sky-400">
                        Razorpay / Payment Transactions
                      </span>
                      <div className="mt-2 space-y-2">
                        {detail.paymentTransactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 p-2.5"
                          >
                            <div>
                              <span className="font-bold text-white">
                                {tx.provider} • {tx.status}
                              </span>
                              <span className="block text-[10px] text-slate-400">
                                Order: {tx.providerOrderId || "--"} • Pay:{" "}
                                {tx.providerPaymentId || "--"}
                                {tx.providerRefundId
                                  ? ` • Refund: ${tx.providerRefundId}`
                                  : ""}
                              </span>
                            </div>
                            <span className="font-bold text-emerald-300">
                              {fmt(tx.amount)}
                              {tx.refundedAmount > 0
                                ? ` (Refunded ${fmt(tx.refundedAmount)})`
                                : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
