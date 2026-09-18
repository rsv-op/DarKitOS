
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Order,
  OrderStatus,
  InventoryItem,
  createMockOrder,
  getAllOrders,
  getAllInventory,
  initDefaultInventory,
} from "../lib/db";

/**
 * Command Center — aggregates live pipeline metrics across all brands.
 * Polls IndexedDB every 1000ms so all tabs stay in lockstep.
 */

const STATUS_ORDER: OrderStatus[] = ["PENDING", "PREPPING", "COMPLETED"];

export default function CommandCenter() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [lastInjected, setLastInjected] = useState<string>("");

  const refresh = useCallback(async () => {
    const [o, inv] = await Promise.all([getAllOrders(), getAllInventory()]);
    setOrders(o);
    setInventory(inv);
  }, []);

  useEffect(() => {
    initDefaultInventory().then(refresh);
    const t = setInterval(refresh, 1000);
    return () => clearInterval(t);
  }, [refresh]);

  const inject = async () => {
    const order = await createMockOrder();
    if (order) {
      setLastInjected(`${order.brand} — ${order.items.join(", ")}`);
      await refresh();
    }
  };

  const countBy = (s: OrderStatus) => orders.filter(o => o.status === s).length;
  const lowStock = inventory.filter(i => i.quantity <= i.reorderThreshold);
  const revenue = orders
    .filter(o => o.status === "COMPLETED")
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <main style={s.page}>
      <header style={s.header}>
        <h1 style={s.h1}>Dark-Cloud Kitchen OS</h1>
        <p style={s.sub}>Command Center · unified multi-brand ledger</p>
        <nav style={s.nav}>
          <Link href="/orders" style={s.link}>Dispatch Pipeline →</Link>
          <Link href="/inventory" style={s.link}>Depletion Matrix →</Link>
        </nav>
      </header>

      <section style={s.grid}>
        {STATUS_ORDER.map(status => (
          <div key={status} style={s.card}>
            <div style={s.metricLabel}>{status}</div>
            <div style={{ ...s.metricValue, color: statusColor(status) }}>{countBy(status)}</div>
          </div>
        ))}
        <div style={s.card}>
          <div style={s.metricLabel}>LOW STOCK</div>
          <div style={{ ...s.metricValue, color: lowStock.length > 0 ? "#f87171" : "#34d399" }}>
            {lowStock.length}
          </div>
        </div>
        <div style={s.card}>
          <div style={s.metricLabel}>REVENUE (COMPLETED)</div>
          <div style={{ ...s.metricValue, color: "#93c5fd" }}>${revenue.toFixed(2)}</div>
        </div>
      </section>

      <section style={s.panel}>
        <h3 style={s.h3}>Simulation</h3>
        <button style={s.primaryBtn} onClick={inject}>+ Inject mock order</button>
        {lastInjected && <p style={s.note}>Last injected: {lastInjected}</p>}
        <p style={s.hint}>All tabs refresh every 1000ms — open /orders and /inventory side by side.</p>
      </section>

      {lowStock.length > 0 && (
        <section style={s.panel}>
          <h3 style={{ ...s.h3, color: "#f87171" }}>⚠ Critical depletion</h3>
          {lowStock.map(i => (
            <p key={i.id} style={s.row}>
              <b>{i.name}</b> ({i.brand}) — {i.quantity} {i.unit} left · threshold {i.reorderThreshold}
            </p>
          ))}
        </section>
      )}
    </main>
  );
}

function statusColor(status: OrderStatus): string {
  return status === "PENDING" ? "#fbbf24" : status === "PREPPING" ? "#60a5fa" : "#34d399";
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: "2rem", maxWidth: 980, margin: "0 auto" },
  header: { marginBottom: "1.5rem" },
  h1: { fontSize: "1.8rem", margin: 0 },
  h3: { marginTop: 0, color: "#93c5fd" },
  sub: { color: "#94a3b8" },
  nav: { display: "flex", gap: "1rem", marginTop: "0.6rem" },
  link: { color: "#60a5fa", textDecoration: "none" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.8rem", marginBottom: "1.2rem" },
  card: { background: "#0f172a", border: "1px solid #1f2937", borderRadius: 12, padding: "1rem", textAlign: "center" },
  metricLabel: { fontSize: "0.7rem", letterSpacing: 1, color: "#94a3b8" },
  metricValue: { fontSize: "1.8rem", fontWeight: 700 },
  panel: { background: "#0f172a", border: "1px solid #1f2937", borderRadius: 12, padding: "1.2rem", marginBottom: "1rem" },
  primaryBtn: { background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "0.6rem 1.2rem", cursor: "pointer", fontSize: "0.95rem" },
  note: { color: "#cbd5e1", fontSize: "0.9rem" },
  hint: { color: "#64748b", fontSize: "0.8rem" },
  row: { color: "#cbd5e1", margin: "0.25rem 0" },
};
