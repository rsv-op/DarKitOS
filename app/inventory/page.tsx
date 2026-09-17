// File: app/inventory/page.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { kitchenDB, InventoryItem } from '../lib/db';

/**
 * Dark-Cloud Kitchen OS - Algorithmic Depletion Matrix
 * Architecture: Next.js Client Component | IndexedDB State Integration
 * Role: Real-time visualization of raw material depletion, automated threshold 
 *       alerts, and procurement checklist generation.
 */

export default function DepletionMatrix() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchInventory = async () => {
    // Ensure DB is seeded if this is the first page loaded
    await kitchenDB.initDefaultInventory();
    const currentStock = await kitchenDB.getInventory();
    
    // Sort critical items to the top
    currentStock.sort((a, b) => {
      const aCritical = a.currentStock <= a.reorderThreshold ? -1 : 1;
      const bCritical = b.currentStock <= b.reorderThreshold ? -1 : 1;
      return aCritical - bCritical;
    });

    setInventory(currentStock);
    setIsHydrated(true);
  };

  useEffect(() => {
    fetchInventory();
    // High-frequency polling to reflect dispatch deductions (every 5 seconds)
    const interval = setInterval(fetchInventory, 5000);
    return () => clearInterval(interval);
  }, []);

  // Procurement Export Protocol
  const exportProcurementList = async () => {
    const criticalItems = inventory.filter(item => item.currentStock <= item.reorderThreshold);
    if (criticalItems.length === 0) return;

    const dateStr = new Date().toLocaleDateString();
    let text = `DARK/CLOUD OS - PROCUREMENT CHECKLIST (${dateStr})\n`;
    text += `=================================================\n\n`;
    
    criticalItems.forEach(item => {
      const deficit = item.reorderThreshold - item.currentStock;
      const recommendedOrder = Math.ceil(deficit * 2.5); // Standard 2.5x buffer restock
      text += `[ ] ${item.name}\n`;
      text += `    Current: ${item.currentStock} ${item.unit} | Target Restock: ${recommendedOrder} ${item.unit}\n\n`;
    });

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Operational Simulation: Receive Vendor Shipment (Hack: Negative deduction = addition)
  const simulateRestock = async (id: string) => {
    await kitchenDB.deductInventory(id, -50); 
    await fetchInventory();
  };

  const criticalCount = inventory.filter(i => i.currentStock <= i.reorderThreshold).length;
  const optimalCount = inventory.length - criticalCount;

  if (!isHydrated) return <div style={s.loading}>Calibrating Depletion Matrix...</div>;

  return (
    <div style={s.container}>
      <header style={s.header}>
        <div>
          <h1 style={s.h1}>Algorithmic Depletion Matrix</h1>
          <p style={s.sub}>Real-time multi-brand raw material tracking & yield optimization.</p>
        </div>
        <button 
          style={{...s.exportBtn, opacity: criticalCount === 0 ? 0.5 : 1}} 
          onClick={exportProcurementList}
          disabled={criticalCount === 0}
        >
          {copied ? "✓ Checklist Copied" : "↓ Export Procurement Checklist"}
        </button>
      </header>

      <div style={s.metricsRow}>
        <div style={s.metricCard}>
          <div style={s.metricLabel}>Critical Depletion Alerts</div>
          <div style={{...s.metricValue, color: criticalCount > 0 ? 'var(--accent-critical)' : 'var(--text-primary)'}}>
            {criticalCount}
          </div>
        </div>
        <div style={s.metricCard}>
          <div style={s.metricLabel}>Optimal Stock Lines</div>
          <div style={{...s.metricValue, color: 'var(--accent-emerald)'}}>
            {optimalCount}
          </div>
        </div>
        <div style={s.metricCard}>
          <div style={s.metricLabel}>Total Tracked SKUs</div>
          <div style={s.metricValue}>{inventory.length}</div>
        </div>
      </div>

      <div style={s.matrixTable}>
        <div style={s.tableHeader}>
          <div style={s.colName}>Raw Material (SKU)</div>
          <div style={s.colStock}>Real-Time Stock</div>
          <div style={s.colThreshold}>Reorder Threshold</div>
          <div style={s.colStatus}>Algorithmic Status</div>
          <div style={s.colAction}>Vendor Operations</div>
        </div>

        <div style={s.tableBody}>
          {inventory.map(item => {
            const isCritical = item.currentStock <= item.reorderThreshold;
            const percentage = Math.min(100, Math.max(0, (item.currentStock / (item.reorderThreshold * 3)) * 100));
            
            return (
              <div key={item.id} style={{...s.tableRow, background: isCritical ? 'rgba(239, 68, 68, 0.05)' : 'transparent'}}>
                <div style={s.colName}>
                  <div style={s.itemName}>{item.name}</div>
                  <div style={s.itemId}>ID: {item.id.toUpperCase()}</div>
                </div>
                
                <div style={s.colStock}>
                  <div style={s.stockDisplay}>
                    <span style={{...s.stockNumber, color: isCritical ? 'var(--accent-critical)' : 'var(--accent-emerald)'}}>
                      {item.currentStock.toFixed(1)}
                    </span>
                    <span style={s.unitLabel}>{item.unit}</span>
                  </div>
                  <div style={s.progressBarBg}>
                    <div style={{...s.progressBarFill, width: `${percentage}%`, background: isCritical ? 'var(--accent-critical)' : 'var(--accent-emerald)'}}></div>
                  </div>
                </div>

                <div style={s.colThreshold}>
                  {item.reorderThreshold} {item.unit}
                </div>

                <div style={s.colStatus}>
                  {isCritical ? (
                    <span style={s.badgeCritical}>Critical Depletion</span>
                  ) : (
                    <span style={s.badgeOptimal}>Yield Optimal</span>
                  )}
                </div>

                <div style={s.colAction}>
                  <button style={s.restockBtn} onClick={() => simulateRestock(item.id)}>
                    Log Shipment
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT STYLES
// ─────────────────────────────────────────────────────────────────
const s: Record<string, any> = {
  loading: { padding: '4rem', textAlign: 'center', color: 'var(--accent-emerald)', fontFamily: 'var(--font-space-grotesk)', fontSize: '1.5rem' },
  container: { padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%', animation: 'fade-in 0.4s ease-out' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' },
  h1: { margin: 0, fontSize: '2.5rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '-0.02em' },
  sub: { margin: '0.5rem 0 0 0', color: 'var(--text-secondary)', fontSize: '1.125rem' },
  
  exportBtn: { background: 'var(--text-primary)', color: 'var(--bg-void)', border: 'none', padding: '0.875rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'transform 0.2s', fontSize: '0.875rem' },

  metricsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' },
  metricCard: { background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: '12px', border: 'var(--border-glass)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
  metricLabel: { color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' },
  metricValue: { fontSize: '2.5rem', fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, lineHeight: 1 },

  matrixTable: { background: 'var(--bg-surface)', borderRadius: '12px', border: 'var(--border-glass)', overflow: 'hidden' },
  tableHeader: { display: 'flex', padding: '1rem 1.5rem', background: 'rgba(0,0,0,0.2)', borderBottom: 'var(--border-glass)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 },
  tableBody: { display: 'flex', flexDirection: 'column' },
  tableRow: { display: 'flex', padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.03)', alignItems: 'center', transition: 'background-color 0.2s' },
  
  colName: { flex: 2, display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingRight: '1rem' },
  colStock: { flex: 2, paddingRight: '2rem' },
  colThreshold: { flex: 1, color: 'var(--text-secondary)', fontSize: '0.875rem', fontFamily: 'monospace' },
  colStatus: { flex: 1 },
  colAction: { flex: 1, display: 'flex', justifyContent: 'flex-end' },

  itemName: { fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' },
  itemId: { fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' },
  
  stockDisplay: { display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' },
  stockNumber: { fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-space-grotesk)' },
  unitLabel: { fontSize: '0.875rem', color: 'var(--text-secondary)' },
  
  progressBarBg: { width: '100%', height: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px', overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: '3px', transition: 'width 0.5s ease-out, background-color 0.3s' },

  badgeCritical: { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.4rem 0.75rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(239, 68, 68, 0.2)', textTransform: 'uppercase' },
  badgeOptimal: { background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.4rem 0.75rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.2)', textTransform: 'uppercase' },

  restockBtn: { background: 'transparent', color: 'var(--accent-sky)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s' }
};
