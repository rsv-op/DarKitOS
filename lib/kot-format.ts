import { formatCurrency } from "@/lib/currency";
import type {
  BrandConfig,
  KitchenConfig,
  KitchenStation,
  Order,
} from "@/lib/db";

export interface KotStationItem {
  name: string;
  quantity: number;
  notes?: string;
  unitPrice: number;
  lineTotal: number;
}

export interface KotStationGroup {
  station: KitchenStation;
  items: KotStationItem[];
}

export interface KotTicketData {
  orderId: string;
  externalOrderId?: string;
  channel: string;
  source: string;
  priority: string;
  brandId: string;
  brandName: string;
  kitchenId: string;
  kitchenCode: string;
  kitchenName: string;
  customerName: string;
  orderNotes?: string;
  istTimestamp: string;
  stations: KotStationGroup[];
  itemCount: number;
  subtotalInr: number;
  gstInr: number;
  totalInr: number;
  formattedSubtotal: string;
  formattedGst: string;
  formattedTotal: string;
}

function formatIstTimestamp(isoDate?: string): string {
  const date = isoDate ? new Date(isoDate) : new Date();
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  const formatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(safe);
  return `${formatted} IST`;
}

export function buildKotTicketData(params: {
  order: Order;
  kitchen?: KitchenConfig | null;
  brand?: BrandConfig | null;
}): KotTicketData {
  const { order, kitchen, brand } = params;
  const stationMap = new Map<KitchenStation, KotStationItem[]>();

  let itemCount = 0;
  let computedSubtotal = 0;

  for (const item of order.items) {
    const station: KitchenStation = item.station || "Assembly";
    const list = stationMap.get(station) ?? [];
    const unitPrice = typeof item.price === "number" ? item.price : 0;
    const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
    list.push({
      name: item.name,
      quantity: item.quantity,
      notes: item.notes,
      unitPrice,
      lineTotal,
    });
    stationMap.set(station, list);
    itemCount += item.quantity;
    computedSubtotal += lineTotal;
  }

  const stationOrder: KitchenStation[] = [
    "Grill",
    "Fryer",
    "Assembly",
    "Cold Prep",
  ];
  const stations: KotStationGroup[] = [];
  for (const st of stationOrder) {
    const items = stationMap.get(st);
    if (items && items.length > 0) {
      stations.push({ station: st, items });
    }
  }

  const subtotalInr =
    typeof order.subtotalAmount === "number"
      ? order.subtotalAmount
      : Math.round(computedSubtotal * 100) / 100;
  const gstInr =
    typeof order.taxAmount === "number" ? order.taxAmount : 0;
  const totalInr =
    typeof order.totalAmount === "number"
      ? order.totalAmount
      : Math.round((subtotalInr + gstInr) * 100) / 100;

  return {
    orderId: order.id,
    externalOrderId: order.externalOrderId,
    channel: order.channel,
    source: order.source,
    priority: order.priority || "NORMAL",
    brandId: order.brandId,
    brandName: brand?.name || order.brandId,
    kitchenId: order.kitchenId,
    kitchenCode: kitchen?.code || order.kitchenId,
    kitchenName: kitchen?.name || `Kitchen ${order.kitchenId}`,
    customerName: order.customerName || "Walk-In Guest",
    orderNotes: order.notes,
    istTimestamp: formatIstTimestamp(order.createdAt),
    stations,
    itemCount,
    subtotalInr,
    gstInr,
    totalInr,
    formattedSubtotal: formatCurrency(subtotalInr, "INR"),
    formattedGst: formatCurrency(gstInr, "INR"),
    formattedTotal: formatCurrency(totalInr, "INR"),
  };
}

const LINE_WIDTH = 42;
const DIVIDER = "-".repeat(LINE_WIDTH);
const DOUBLE_DIVIDER = "=".repeat(LINE_WIDTH);

function padColumns(left: string, right: string, width = LINE_WIDTH): string {
  const cleanLeft = left.trim();
  const cleanRight = right.trim();
  const gap = width - cleanLeft.length - cleanRight.length;
  if (gap >= 1) {
    return `${cleanLeft}${" ".repeat(gap)}${cleanRight}`;
  }
  const maxLeft = Math.max(1, width - cleanRight.length - 1);
  return `${cleanLeft.slice(0, maxLeft)} ${cleanRight}`;
}

function centerLine(text: string, width = LINE_WIDTH): string {
  const clean = text.trim().slice(0, width);
  const padLeft = Math.max(0, Math.floor((width - clean.length) / 2));
  return `${" ".repeat(padLeft)}${clean}`;
}

/**
 * Formats a 42-column (80mm Font-A standard) ESC/POS plain-text/command payload
 * suitable for LAN thermal print bridges and receipt inspection.
 */
export function renderEscPosTextPayload(ticket: KotTicketData): string {
  const lines: string[] = [
    "[ESC @]",
    "[ALIGN CENTER]",
    "[BOLD ON]",
    centerLine("DARKITOS 80MM KOT TICKET"),
    centerLine(`${ticket.brandName.toUpperCase()} (${ticket.kitchenCode})`),
    "[BOLD OFF]",
    centerLine(ticket.kitchenName),
    "[ALIGN LEFT]",
    DOUBLE_DIVIDER,
    "[BOLD ON]",
    padColumns(`ORDER: ${ticket.orderId}`, `[${ticket.channel.toUpperCase()}]`),
    "[BOLD OFF]",
  ];

  if (ticket.externalOrderId) {
    lines.push(padColumns("EXT REF:", ticket.externalOrderId));
  }
  if (ticket.priority && ticket.priority !== "NORMAL") {
    lines.push("[BOLD ON]");
    lines.push(centerLine(`*** PRIORITY: ${ticket.priority} ***`));
    lines.push("[BOLD OFF]");
  }

  lines.push(padColumns("GUEST:", ticket.customerName.slice(0, 32)));
  lines.push(padColumns("TIME:", ticket.istTimestamp));
  lines.push(DIVIDER);

  for (const group of ticket.stations) {
    lines.push("[BOLD ON]");
    lines.push(`[STATION: ${group.station.toUpperCase()}]`);
    lines.push("[BOLD OFF]");
    for (const item of group.items) {
      const qtyName = `${item.quantity}x ${item.name}`;
      lines.push(padColumns(qtyName, `Rs.${item.lineTotal.toFixed(2)}`));
      if (item.notes?.trim()) {
        lines.push(`   NOTE: ${item.notes.trim().slice(0, LINE_WIDTH - 9)}`);
      }
    }
    lines.push(DIVIDER);
  }

  if (ticket.orderNotes?.trim()) {
    lines.push("[BOLD ON]");
    lines.push(`ORDER NOTE: ${ticket.orderNotes.trim().slice(0, LINE_WIDTH - 12)}`);
    lines.push("[BOLD OFF]");
    lines.push(DIVIDER);
  }

  lines.push(padColumns(`ITEMS (${ticket.itemCount}) SUBTOTAL:`, `Rs.${ticket.subtotalInr.toFixed(2)}`));
  lines.push(padColumns("GST (5%):", `Rs.${ticket.gstInr.toFixed(2)}`));
  lines.push("[BOLD ON]");
  lines.push(padColumns("GRAND TOTAL (INR):", `Rs.${ticket.totalInr.toFixed(2)}`));
  lines.push("[BOLD OFF]");
  lines.push(DOUBLE_DIVIDER);
  lines.push(centerLine("CHECK SEAL & DISPATCH TICKET"));
  lines.push("[FEED 3]");
  lines.push("[CUT PARTIAL]");

  return lines.join("\n");
}
