import { formatCurrency, type SupportedCurrency } from "@/lib/currency";

export interface BottleneckOption {
  id: string;
  label: string;
  category: "Inventory" | "Aggregators" | "Finance & GST" | "Kitchen Floor" | "Team & Access" | "Automation";
  sprint: "Sprint 1" | "Sprint 2" | "Sprint 3A" | "Sprint 3B" | "Sprint 4";
  ownerSummary: string;
  technicalScope: string;
}

export const BOTTLENECK_CATALOG: BottleneckOption[] = [
  {
    id: "multi-kitchen-inventory",
    label: "Per-Kitchen Inventory & Stock Transfers",
    category: "Inventory",
    sprint: "Sprint 1",
    ownerSummary:
      "Track raw ingredient stock separately per cloud kitchen (Gurugram, Noida, South Delhi) with atomic recipe depletion and inter-kitchen stock transfers.",
    technicalScope:
      "Supabase PostgreSQL (Mumbai ap-south-1) + Drizzle ORM with composite (kitchen_id, ingredient_id) ledgers, SELECT FOR UPDATE atomic depletion, and transfer movements.",
  },
  {
    id: "gst-invoicing-upi",
    label: "GST Invoices (CGST/SGST) & Direct UPI Checkout",
    category: "Finance & GST",
    sprint: "Sprint 3A",
    ownerSummary:
      "Generate GST-compliant restaurant bills with FSSAI/GSTIN numbers, Tally/Zoho export, and commission-free Razorpay UPI direct ordering.",
    technicalScope:
      "5% restaurant GST engine (CGST/SGST/IGST), sequential FY invoice numbers, Razorpay checkout + verified payment/refund webhooks, CSV/Tally accounting export.",
  },
  {
    id: "aggregator-reconciliation",
    label: "Swiggy / Zomato Order Sync & Payout Audits",
    category: "Aggregators",
    sprint: "Sprint 3B",
    ownerSummary:
      "Receive live Swiggy & Zomato orders automatically in one KDS queue and catch missing payouts, commission discrepancies, and menu stockouts.",
    technicalScope:
      "UrbanPiper signed webhook ingestion, PostgreSQL transactional outbox + Upstash QStash retries, automatic menu 86'ing on low stock, and payout variance reconciliation.",
  },
  {
    id: "cancellation-waste",
    label: "Mid-Prep Cancellation Loss & Dispute Claims",
    category: "Finance & GST",
    sprint: "Sprint 1",
    ownerSummary:
      "Separate pre-prep cancellations from cooked food waste and automatically build evidence packets for post-pickup aggregator dispute claims.",
    technicalScope:
      "Persist stage-aware cancellation ledger and courier pickup timestamps in Postgres; automate dispute claim filing payloads for Swiggy/Zomato support.",
  },
  {
    id: "kds-realtime-kot",
    label: "Instant KDS Sync & 80mm Thermal KOT Printing",
    category: "Kitchen Floor",
    sprint: "Sprint 4",
    ownerSummary:
      "Eliminate polling delays between order receipt and cooking stations, add loud new-order chimes, and auto-print 80mm thermal KOT tickets.",
    technicalScope:
      "Supabase Realtime channels (<500ms KDS/Dispatch updates) in Sprint 2 plus ESC/POS thermal KOT print bridge and Web Audio station alerts in Sprint 4.",
  },
  {
    id: "staff-access-shifts",
    label: "Staff Logins & Strict Kitchen-Level Access",
    category: "Team & Access",
    sprint: "Sprint 2",
    ownerSummary:
      "Give every cook, dispatcher, and kitchen manager their own secure login locked strictly to their assigned kitchen and shift permissions.",
    technicalScope:
      "Supabase Auth (Email/OTP) replacing demo codes, PostgreSQL Row-Level Security (RLS), and full server-side RBAC audit logging.",
  },
  {
    id: "whatsapp-alerts",
    label: "WhatsApp Low-Stock & Rider-Wait Alerts",
    category: "Automation",
    sprint: "Sprint 3B",
    ownerSummary:
      "Send automatic WhatsApp alerts to kitchen managers when key proteins drop below reorder threshold or orders sit waiting for a rider over 10 minutes.",
    technicalScope:
      "Interakt / Gupshup WhatsApp Business API triggered from the transactional outbox when stock crosses threshold or dispatch SLA is breached.",
  },
  {
    id: "ai-ops-copilot",
    label: "Daily AI Margin & Bottleneck Copilot",
    category: "Automation",
    sprint: "Sprint 4",
    ownerSummary:
      "Get a plain-English daily WhatsApp/dashboard digest explaining which dish or kitchen lost margin yesterday and what to reorder before dinner rush.",
    technicalScope:
      "Server-side POST /api/ai/diagnose (Gemini API) grounded exclusively on persisted Postgres orders, variance movements, and cancellation telemetry.",
  },
];

export interface OwnerBriefTelemetry {
  grossRevenue: number;
  aov: number;
  activeOrdersCount: number;
  completedOrdersCount: number;
  cancelledOrdersCount: number;
  totalLoss: number;
  totalClaims: number;
  totalLeakage: number;
  lowStockItems: string[];
  activeBrandsCount: number;
  onlineKitchensCount: number;
  currency?: SupportedCurrency;
}

export interface OwnerBottleneckInput {
  ownerName: string;
  kitchenScope: string;
  selectedBottleneckIds: string[];
  dailyOrderVolume: string;
  monthlyRevenueBand: string;
  urgency: "THIS_WEEK" | "THIS_MONTH" | "THIS_QUARTER";
  customNotes: string;
  telemetry: OwnerBriefTelemetry;
  generatedAtIso?: string;
}

export interface GeneratedOwnerBrief {
  fileName: string;
  markdown: string;
  selectedCount: number;
}

const URGENCY_LABELS: Record<OwnerBottleneckInput["urgency"], string> = {
  THIS_WEEK: "Urgent (Go-Live / Fix This Week)",
  THIS_MONTH: "Priority (Target Delivery This Month)",
  THIS_QUARTER: "Planned Roadmap (This Quarter)",
};

export function generateOwnerBottleneckBrief(
  input: OwnerBottleneckInput,
): GeneratedOwnerBrief {
  const currency: SupportedCurrency = input.telemetry.currency ?? "INR";
  const nowIso = input.generatedAtIso ?? new Date().toISOString();
  const dateStamp = nowIso.slice(0, 10);
  const ownerName = input.ownerName.trim() || "Cloud Kitchen Owner";
  const kitchenScope = input.kitchenScope.trim() || "All Kitchens";

  const selectedOptions = BOTTLENECK_CATALOG.filter((item) =>
    input.selectedBottleneckIds.includes(item.id),
  );

  const uniqueSprints = Array.from(
    new Set(selectedOptions.map((o) => o.sprint)),
  ).sort();

  const fmt = (value: number) => formatCurrency(value, currency);

  const bottleneckSection =
    selectedOptions.length > 0
      ? selectedOptions
          .map(
            (b, idx) =>
              `### ${idx + 1}. ${b.label} (\`${b.sprint}\` · ${b.category})
- **Owner Pain / Goal:** ${b.ownerSummary}
- **Target Engineering Scope:** ${b.technicalScope}`,
          )
          .join("\n\n")
      : "_No pre-set bottlenecks checked yet — see Owner Notes below._";

  const lowStockText =
    input.telemetry.lowStockItems.length > 0
      ? input.telemetry.lowStockItems.join(", ")
      : "None currently below reorder threshold";

  const customNotesBlock = input.customNotes.trim()
    ? input.customNotes.trim()
    : "No additional freeform notes provided.";

  const markdown = `# DarKIT OS — Owner Bottleneck & Engineering Brief

**Generated:** ${nowIso}  
**Prepared For:** Gemini / Lead Full-Stack Dev AI  
**Prepared By:** ${ownerName}  
**Kitchen Scope:** ${kitchenScope}  
**Currency Basis:** ${currency}

---

## 1. Business Context & Urgency
| Field | Value |
| --- | --- |
| **Daily Order Volume** | ${input.dailyOrderVolume || "Not specified"} |
| **Monthly Revenue Band** | ${input.monthlyRevenueBand || "Not specified"} |
| **Target Timeline** | ${URGENCY_LABELS[input.urgency]} |
| **Active Brands / Online Kitchens** | ${input.telemetry.activeBrandsCount} brand(s) across ${input.telemetry.onlineKitchensCount} kitchen(s) |
| **Recommended Roadmap Sprints** | ${uniqueSprints.length > 0 ? uniqueSprints.join(", ") : "Sprint 1 (Core Persistence)"} |

---

## 2. Live Operational Snapshot (From DarKIT OS)
- **Gross Order Revenue:** ${fmt(input.telemetry.grossRevenue)} (Avg Order Value: ${fmt(input.telemetry.aov)})
- **Order Pipeline:** ${input.telemetry.activeOrdersCount} active · ${input.telemetry.completedOrdersCount} dispatched · ${input.telemetry.cancelledOrdersCount} cancelled
- **Cancellation Food & Labor Loss:** ${fmt(input.telemetry.totalLoss)}
- **Aggregator Dispute Claims Logged:** ${fmt(input.telemetry.totalClaims)}
- **Estimated Monthly Leakage Vectors:** ${fmt(input.telemetry.totalLeakage)}
- **Current Low-Stock Watchlist:** ${lowStockText}

---

## 3. Priority Owner Bottlenecks
${bottleneckSection}

---

## 4. Owner Notes (Plain Language)
> ${customNotesBlock.replace(/\n/g, "\n> ")}

---

## 5. Verified Codebase Baseline (Sprint 0 Complete)
When planning or writing code against \`rsv-op/DarKitOS\`, rely on these verified facts:
1. **Working Today (Sprint 0):** Next.js 14 App Router + TypeScript + Tailwind, INR (\`₹\`) formatting via \`lib/currency.ts\`, canonical in-memory store (\`lib/store.ts\`), hardened JWT auth & role/kitchen RBAC across all \`/api/*\` routes, stage-aware cancellations, atomic recipe stock depletion (with audit persistence on insufficient stock), clean \`npm run lint\`, and baseline Vitest domain/API suite.
2. **Not Yet Live (Do Not Assume Exists):** No PostgreSQL database yet (state resets on server restart), inventory rows are currently shared across kitchens until Sprint 1 splits \`(kitchenId, ingredientId)\`, no live Swiggy/Zomato/UrbanPiper webhooks, no GST/Razorpay integration, and no real-time WebSocket/Supabase Realtime transport yet (currently HTTP polling).

---

## 6. Locked Architecture & Vendor Guardrails
- **Database & ORM:** Supabase PostgreSQL (Mumbai \`ap-south-1\`) + Drizzle ORM (\`db/schema.ts\` + \`lib/db-client.ts\`). Keep \`lib/db.ts\` client-safe (types/helpers only — never import DB drivers there).
- **Canonical Service Boundary:** Preserve \`lib/store.ts\` (migrated from sync to \`async\`) + existing \`/api/*\` route contracts; React components must never query the DB directly.
- **Auth & Realtime (Sprint 2):** Supabase Auth + Supabase Realtime (\`<500ms\` KDS/Dispatch updates).
- **India Compliance & Payments (Sprint 3A):** Day-1 GST (CGST/SGST/IGST, GSTIN, FSSAI, sequential FY invoices, Tally/Zoho CSV) + Razorpay Direct Web UPI & refunds.
- **Aggregators & Alerts (Sprint 3B):** UrbanPiper signed webhooks + PostgreSQL Outbox/Upstash QStash + Interakt/Gupshup WhatsApp alerts.
- **Hardware & AI Copilot (Sprint 4):** 80mm ESC/POS thermal KOT printing + server-side \`POST /api/ai/diagnose\` Gemini copilot.

---

## 7. Immediate Request to Dev AI
1. Review the selected bottlenecks and live INR snapshot above.
2. Propose a concrete, step-by-step engineering plan starting with the earliest required Sprint (${uniqueSprints[0] || "Sprint 1"}).
3. Confirm database schema changes, API contract impacts, and Vitest acceptance tests before writing code.
`;

  return {
    fileName: `darkitos-owner-brief-${dateStamp}.md`,
    markdown,
    selectedCount: selectedOptions.length,
  };
}
