
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { InventoryItem, adjustInventory, getAllInventory, initDefaultInventory } from "../../lib/db";

/**
 * Algorithmic Depletion Matrix — real-time stock vs reorderThreshold.
 * Critical items (ratio ≤ 1.0) float to the top. Polls every 1000ms.
 */

type StockLevel = "critical" | "low" | "ok";

function levelOf(item: InventoryItem): StockLevel {
  const ratio = item.quantity / item.reorderThreshold;
  return ratio <= 1 ? "critical" : ratio <= 1.5 ? "low" : "ok";
}

const LEVEL_COLOR: Record<StockLevel, string> = {
  critical: "#f87171",
  low: "#fbbf24",
  ok: "#34d399",
};

export default function AlgorithmicDepletionMatrix() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const refresh = useCallback(async () => {
    setInventory(await getAllInventory());
  }, []);

  useEffect(() => {
    initDefaultInventory().then(refresh);
    const t = setInterval(refresh, 1000);
    return () => clearInterval(t);
  }, [refresh]);

  const adjust = async (id: string, delta: number) => {
    await adjustInventory(id, delta);
    await refresh();
  };

  const sorted = [...inventory].sort((a, b) => {
    const ra = a.quantity / a.reorderThreshold;
    const rb = b.quantity / b.reorderThreshold;
    return ra - rb;
  });

  const criticalCount = inventory.filter(i => levelOf(i) === "critical").length;

  return (
    <main style={s.page}>
      <header style={s.header}>
        <h1 style={s.h1}>Algorithmic Depletion Matrix</h1>
        <p style={s.sub}>
          <Link href="/" style={s.link}>← Command Center</Link> ·{" "}
          <span style={{ color: criticalCount > 0 ? "#f87171" : "#34d399" }}>
            {criticalCount} critical
          </span>{" "}
          · live sync every 1000ms
        </p>
      </header>

      <div style={s.table}>
        <div style={s.rowHead}>
          <span>Item</span><span>Brand</span><span>Stock</span><span>Threshold</span><span>Ratio</span><span>Level</span><span>Adjust</span>
        </div>
        {sorted.map(item => {
          const level = levelOf(item);
          const ratio = item.quantity / item.reorderThreshold;
          return (
            <div key={item.id} style={{ ...s.row, borderLeft: `4px solid ${LEVEL_COLOR[level]}` }}>
              <span style={s.cellName}>{item.name}</span>
              <span style={s.cell}>{item.brand}</span>
              <span style={{ ...s.cell, fontWeight: 700 }}>{item.quantity} {item.unit}</span>
              <span style={s.cell}>{item.reorderThreshold}</span>
              <span style={{ ...s.cell, color: LEVEL_COLOR[level], fontWeight: 700 }}>
                {ratio.toFixed(2)}×
              </span>
              <span style={{ ...s.cell, color: LEVEL_COLOR[level], textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: 1 }}>
                {level}
              </span>
              <span style={{ ...s.cell, display: "flex", gap: "0.4rem" }}>
                <button style={s.stepBtn} onClick={() => adjust(item.id, -1)}>−</button>
                <button style={s.stepBtn} onClick={() => adjust(item.id, +1)}>+</button>
                <button style={s.stepBtn} onClick={() => adjust(item.id, +10)}>+10</button>
              </span>
            </div>
          );
        })}
        {sorted.length === 0 && <p style={s.empty}>Inventory empty — seeding defaults…</p>}
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: "2rem", maxWidth: 980, margin: "0 auto" },
  header: { marginBottom: "1.2rem" },
  h1: { fontSize: "1.6rem", margin: 0 },
  sub: { color: "#94a3b8" },
  link: { color: "#60a5fa", textDecoration: "none" },
  table: { background: "#0f172a", border: "1px solid #1f2937", borderRadius: 12, overflow: "hidden" },
  rowHead: {
    display: "grid", gridTemplateColumns: "1.4fr 1fr 0.8fr 0.8fr 0.6fr 0.8fr 1fr",
    padding: "0.7rem 1rem", fontSize: "0.7rem", letterSpacing: 1, color: "#64748b",
    textTransform: "uppercase", borderBottom: "1px solid #1f2937",
  },
  row: {
    display: "grid", gridTemplateColumns: "1.4fr 1fr 0.8fr 0.8fr 0.6fr 0.8fr 1fr",
    padding: "0.7rem 1rem", borderBottom: "1px solid #162032", alignItems: "center",
  },
  cell: { color: "#cbd5e1", fontSize: "0.9rem" },
  cellName: { color: "#e2e8f0", fontWeight: 600 },
  stepBtn: { background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, padding: "0.25rem 0.6rem", cursor: "pointer" },
  empty: { color: "#475569", padding: "2rem", textAlign: "center" },
};
