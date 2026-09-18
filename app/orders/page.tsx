
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Order, OrderStatus, getAllOrders, setOrderStatus } from "../../lib/db";

/**
 * Unified Dispatch Pipeline — high-contrast Kanban.
 * PENDING → PREPPING → COMPLETED. Polls IndexedDB every 1000ms.
 */

const COLUMNS: { status: OrderStatus; color: string }[] = [
  { status: "PENDING", color: "#fbbf24" },
  { status: "PREPPING", color: "#60a5fa" },
  { status: "COMPLETED", color: "#34d399" },
];

export default function UnifiedDispatchPipeline() {
  const [orders, setOrders] = useState<Order[]>([]);

  const refresh = useCallback(async () => {
    setOrders(await getAllOrders());
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 1000);
    return () => clearInterval(t);
  }, [refresh]);

  const move = async (order: Order, dir: 1 | -1) => {
    const idx = COLUMNS.findIndex(c => c.status === order.status);
    const next = COLUMNS[idx + dir]?.status;
    if (!next) return;
    await setOrderStatus(order.id, next);
    await refresh();
  };

  return (
    <main style={s.page}>
      <header style={s.header}>
        <h1 style={s.h1}>Unified Dispatch Pipeline</h1>
        <p style={s.sub}>
          <Link href="/" style={s.link}>← Command Center</Link> · live sync every 1000ms
        </p>
      </header>

      <div style={s.board}>
        {COLUMNS.map(({ status, color }) => {
          const col = orders.filter(o => o.status === status);
          return (
            <section key={status} style={s.column}>
              <h2 style={{ ...s.colTitle, color }}>
                {status} <span style={s.count}>{col.length}</span>
              </h2>
              {col.sort((a, b) => a.createdAt - b.createdAt).map(o => (
                <article key={o.id} style={s.ticket}>
                  <div style={s.ticketBrand}>{o.brand}</div>
                  <ul style={s.ticketItems}>
                    {o.items.map((it, i) => <li key={i} style={s.ticketItem}>{it}</li>)}
                  </ul>
                  <div style={s.ticketMeta}>
                    <span>${o.total.toFixed(2)}</span>
                    <span>{new Date(o.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div style={s.ticketActions}>
                    <button style={s.ghostBtn} disabled={status === "PENDING"} onClick={() => move(o, -1)}>↩</button>
                    <button
                      style={{ ...s.moveBtn, background: status === "COMPLETED" ? "#1f2937" : "#2563eb" }}
                      disabled={status === "COMPLETED"}
                      onClick={() => move(o, 1)}
                    >
                      {status === "PENDING" ? "Start prepping →" : status === "PREPPING" ? "Complete →" : "Done"}
                    </button>
                  </div>
                </article>
              ))}
              {col.length === 0 && <p style={s.empty}>No orders</p>}
            </section>
          );
        })}
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: "2rem", maxWidth: 1200, margin: "0 auto" },
  header: { marginBottom: "1.2rem" },
  h1: { fontSize: "1.6rem", margin: 0 },
  sub: { color: "#94a3b8" },
  link: { color: "#60a5fa", textDecoration: "none" },
  board: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" },
  column: { background: "#0f172a", border: "1px solid #1f2937", borderRadius: 12, padding: "1rem", minHeight: 300 },
  colTitle: { fontSize: "0.85rem", letterSpacing: 1, marginTop: 0 },
  count: { background: "#1f2937", borderRadius: 99, padding: "0.1rem 0.5rem", fontSize: "0.75rem" },
  ticket: { background: "#111c33", border: "1px solid #24304d", borderRadius: 10, padding: "0.8rem", marginBottom: "0.7rem" },
  ticketBrand: { fontWeight: 700, color: "#93c5fd", fontSize: "0.85rem" },
  ticketItems: { margin: "0.4rem 0", paddingLeft: "1rem", color: "#cbd5e1", fontSize: "0.85rem" },
  ticketItem: { marginBottom: "0.15rem" },
  ticketMeta: { display: "flex", justifyContent: "space-between", color: "#94a3b8", fontSize: "0.75rem" },
  ticketActions: { display: "flex", gap: "0.5rem", marginTop: "0.6rem" },
  moveBtn: { flex: 1, color: "#fff", border: "none", borderRadius: 8, padding: "0.45rem", cursor: "pointer" },
  ghostBtn: { background: "transparent", border: "1px solid #334155", color: "#94a3b8", borderRadius: 8, padding: "0.45rem 0.7rem", cursor: "pointer" },
  empty: { color: "#475569", fontSize: "0.85rem", textAlign: "center", marginTop: "2rem" },
};
