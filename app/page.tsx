// File: app/page.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { kitchenDB, Order, InventoryItem } from '../lib/db';

/**
 * Dark-Cloud Kitchen OS - Unified Command Center
 * Architecture: Next.js Client Component | IndexedDB State Integration
 * Role: Aggregates real-time telemetry across all 4 brands, tracks active 
 *       pipeline revenue, and surfaces algorithmic inventory depletion alerts.
 */

// Define the 4 target brands operating inside this single physical kitchen
const INTERNAL_BRANDS = [
  { id: 'b_001', name: 'Ghost Burger Protocol', color: '#ef4444' },
  { id: 'b_002', name: 'Wok Star Syndicate', color: '#f59e0b' },
  { id: 'b_003', name: 'Pizza Cartel', color: '#10b981' },
  { id: 'b_004', name: 'Curry Dispatch', color: '#38bdf8' }
];

export default function CommandCenter() {
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [inventoryAlerts, setInventoryAlerts] = useState<number>(0);
  const [isHydrated, setIsHydrated] = useState(false);

  // Initialize DB and fetch real-time state
  const refreshTelemetry = async () => {
    await kitchenDB.initDefaultInventory();
    const orders = await kitchenDB.getActiveOrders();
    const inventory = await kitchenDB.getInventory();
    
    setActiveOrders(orders);
    
    // Algorithmic alert logic: flag inventory items at or below reorder threshold
    const criticalStock = inventory.filter(item => item.currentStock <= item.reorderThreshold).length;
    setInventoryAlerts(criticalStock);
    
    setIsHydrated(true);
  };

  useEffect(() => {
    refreshTelemetry();
    
    // Polling simulation for active kitchen environments (refreshes every 10s)
    const interval = setInterval(refreshTelemetry, 10000);
    return () => clearInterval(interval);
  }, []);

  // Prototype Utility: Simulate incoming cross-brand API payloads
  const simulateInboundOrder = async () => {
    const randomBrand = INTERNAL_BRANDS[Math.floor(Math.random() * INTERNAL_BRANDS.length)];
    const mockOrder: Order = {
      id: `ord_${Math.random().toString(36).substring(2, 9)}`,
      brandId: randomBrand.id,
      brandName: randomBrand.name,
      items: [
        { name: 'Signature Combo', quantity: Math.floor(Math.random() * 3) + 1 },
        { name: 'Beverage Add-on', quantity: Math.floor(Math.random() * 2) + 1 }
      ],
      status: 'RECEIVED',
      totalValue: Math.floor(Math.random() * 1200) + 300, // ₹300 - ₹1500
      timestamp: Date.now()
    };

    await kitchenDB.addOrder(mockOrder);
    await refreshTelemetry();
  };

  // KPI Calculations
  const activePipelineValue = activeOrders.reduce((sum, order) => sum + order.totalValue, 0);
  const preppingCount = activeOrders.filter(o => o.status === 'PREPPING').length;
  const receivedCount = activeOrders.filter(o => o.status === 'RECEIVED').length;

  if (!isHydrated) return <div style={s.loading}>Booting Kitchen Matrix...</div>;

  return (
    <div style={s.dashboard}>
      <header style={s.header}>
        <div>
          <h1 style={s.h1}>Command Center</h1>
          <p style={s.sub}>Unified multi-brand operational telemetry.</p>
        </div>
        <button style={s.simulateBtn} onClick={simulateInboundOrder}>
          + Simulate API Order Ingestion
        </button>
      </header>

      {/* Primary KPI Row */}
      <section style={s.kpiGrid}>
        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>Active Cross-Brand Orders</div>
          <div style={s.kpiValue}>{activeOrders.length}</div>
          <div style={s.kpiSub}>Queue Velocity: Normal</div>
        </div>
        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>Live Pipeline Revenue</div>
          <div style={s.kpiValue}>₹{activePipelineValue.toLocaleString()}</div>
          <div style={s.kpiSub}>Unrealized Active Tickets</div>
        </div>
        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>Algorithmic Depletion Alerts</div>
          <div style={s.kpiValue} style={{...s.kpiValue, color: inventoryAlerts > 0 ? 'var(--accent-critical)' : 'var(--accent-emerald)'}}>
            {inventoryAlerts}
          </div>
          <div style={s.kpiSub}>Action Required on Stock</div>
        </div>
      </section>

      <div style={s.matrixContainer}>
        {/* Brand Status Matrix */}
        <section style={s.brandMatrix}>
          <h2 style={s.h2}>Brand Status Matrix</h2>
          <div style={s.brandList}>
            {INTERNAL_BRANDS.map(brand => {
              const brandOrders = activeOrders.filter(o => o.brandId === brand.id);
              return (
                <div key={brand.id} style={s.brandRow}>
                  <div style={s.brandIdent}>
                    <div style={{...s.brandColor, backgroundColor: brand.color}}></div>
                    <span style={s.brandName}>{brand.name}</span>
                  </div>
                  <div style={s.brandStats}>
                    <span style={s.statPill}>{brandOrders.length} Active</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Global Dispatch Feed */}
        <section style={s.dispatchFeed}>
          <h2 style={s.h2}>Global Intake Feed</h2>
          {activeOrders.length === 0 ? (
            <div style={s.emptyState}>No active orders. Awaiting API telemetry.</div>
          ) : (
            <div style={s.orderList}>
              {activeOrders.map(order => (
                <div key={order.id} style={s.orderCard}>
                  <div style={s.orderHeader}>
                    <span style={s.orderId}>#{order.id.split('_')[1].toUpperCase()}</span>
                    <span style={s.orderTime}>
                      {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={s.orderBrand}>{order.brandName}</div>
                  <div style={s.orderStatus}>
                    <span style={s.statusBadge(order.status)}>{order.status}</span>
                    <span style={s.orderValue}>₹{order.totalValue}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT STYLES
// ─────────────────────────────────────────────────────────────────
const s: Record<string, any> = {
  loading: { padding: '4rem', textAlign: 'center', color: 'var(--accent-sky)', fontFamily: 'var(--font-space-grotesk)', fontSize: '1.25rem' },
  dashboard: { padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%', animation: 'fade-in 0.6s ease-out' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' },
  h1: { margin: 0, fontSize: '2.5rem', color: 'var(--text-primary)' },
  h2: { margin: '0 0 1.5rem 0', fontSize: '1.25rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  sub: { margin: '0.5rem 0 0 0', color: 'var(--text-secondary)', fontSize: '1rem' },
  simulateBtn: { background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-sky)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' },
  
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '3rem' },
  kpiCard: { background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: '12px', border: 'var(--border-glass)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
  kpiLabel: { color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' },
  kpiValue: { fontSize: '2.5rem', color: 'var(--text-primary)', fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, lineHeight: 1 },
  kpiSub: { color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.75rem' },

  matrixContainer: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'start' },
  
  brandMatrix: { background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: '12px', border: 'var(--border-glass)' },
  brandList: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  brandRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(11, 19, 43, 0.5)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' },
  brandIdent: { display: 'flex', alignItems: 'center', gap: '1rem' },
  brandColor: { width: '12px', height: '12px', borderRadius: '50%' },
  brandName: { fontWeight: 600, fontSize: '0.875rem' },
  statPill: { background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' },

  dispatchFeed: { background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: '12px', border: 'var(--border-glass)' },
  orderList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' },
  orderCard: { background: 'rgba(11, 19, 43, 0.5)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  orderHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontFamily: 'monospace', color: 'var(--text-primary)', fontWeight: 700, letterSpacing: '0.1em' },
  orderTime: { fontSize: '0.75rem', color: 'var(--text-muted)' },
  orderBrand: { fontSize: '0.875rem', color: 'var(--accent-sky)', fontWeight: 600 },
  orderStatus: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' },
  orderValue: { fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, color: 'var(--accent-emerald)' },
  emptyState: { padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' },

  statusBadge: (status: string) => {
    let bg = 'rgba(255,255,255,0.1)';
    let color = '#94a3b8';
    if (status === 'RECEIVED') { bg = 'rgba(239, 68, 68, 0.1)'; color = '#ef4444'; }
    if (status === 'PREPPING') { bg = 'rgba(245, 158, 11, 0.1)'; color = '#f59e0b'; }
    
    return {
      background: bg,
      color: color,
      fontSize: '0.65rem',
      fontWeight: 700,
      padding: '0.25rem 0.5rem',
      borderRadius: '4px',
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    };
  }
};
