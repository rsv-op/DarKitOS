
// File: app/orders/page.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { kitchenDB, Order, OrderStatus } from '../../lib/db';

/**
 * Dark-Cloud Kitchen OS - Unified Dispatch Pipeline
 * Architecture: Next.js Client Component | IndexedDB State Mutation
 * Role: High-contrast, large touch-target Kanban interface for line cooks to 
 *       triage cross-brand orders and trigger algorithmic inventory depletion.
 */

export default function UnifiedDispatch() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchOrders = async () => {
    const activeOrders = await kitchenDB.getActiveOrders();
    setOrders(activeOrders);
    setIsHydrated(true);
  };

  useEffect(() => {
    fetchOrders();
    // High-frequency polling for kitchen environments (every 5 seconds)
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStateTransition = async (order: Order, nextStatus: OrderStatus) => {
    setProcessingId(order.id);
    
    try {
      // Execute the local database state mutation
      await kitchenDB.updateOrderStatus(order.id, nextStatus);

      // Algorithmic Depletion Trigger: If moving to PREPPING, deduct standard inventory
      if (nextStatus === 'PREPPING') {
        // In a production mapping, we iterate over order.items and deduct exact recipe ratios.
        // For this edge prototype, we simulate a standard deduction from our seeded inventory items.
        await kitchenDB.deductInventory('inv_1', 0.5); // Deduct 0.5kg Rice
        await kitchenDB.deductInventory('inv_4', 0.2); // Deduct 0.2kg Chicken
      }

      // Re-hydrate the UI instantly
      await fetchOrders();
    } catch (error) {
      console.error("State Transition Failed:", error);
    } finally {
      setProcessingId(null);
    }
  };

  if (!isHydrated) return <div style={s.loading}>Initializing Dispatch Pipeline...</div>;

  return (
    <div style={s.container}>
      <header style={s.header}>
        <h1 style={s.h1}>Active Dispatch Pipeline</h1>
        <div style={s.metrics}>
          <span style={s.metricBadge}>Total Active: {orders.length}</span>
          <span style={s.metricBadge}>Action Required: {orders.filter(o => o.status === 'RECEIVED').length}</span>
        </div>
      </header>

      {orders.length === 0 ? (
        <div style={s.emptyState}>
          <div style={s.emptyIcon}>✓</div>
          <h2>Kitchen Clear</h2>
          <p>All cross-brand orders have been successfully dispatched.</p>
        </div>
      ) : (
        <div style={s.pipelineGrid}>
          {orders.map(order => (
            <div key={order.id} style={{...s.orderCard, ...s[`card_${order.status}`]}}>
              
              <div style={s.cardHeader}>
                <div style={s.brandBadge}>{order.brandName}</div>
                <div style={s.timeTracker}>
                  {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              <div style={s.orderId}>#{order.id.split('_')[1].toUpperCase()}</div>

              <div style={s.itemList}>
                {order.items.map((item, idx) => (
                  <div key={idx} style={s.itemRow}>
                    <span style={s.itemQty}>{item.quantity}x</span>
                    <span style={s.itemName}>{item.name}</span>
                  </div>
                ))}
              </div>

              <div style={s.actionFooter}>
                {order.status === 'RECEIVED' && (
                  <button 
                    style={{...s.actionBtn, ...s.btnPrepping}} 
                    disabled={processingId === order.id}
                    onClick={() => handleStateTransition(order, 'PREPPING')}
                  >
                    {processingId === order.id ? 'PROCESSING...' : 'ACCEPT & START PREP'}
                  </button>
                )}
                
                {order.status === 'PREPPING' && (
                  <button 
                    style={{...s.actionBtn, ...s.btnReady}}
                    disabled={processingId === order.id}
                    onClick={() => handleStateTransition(order, 'READY')}
                  >
                    {processingId === order.id ? 'PROCESSING...' : 'MARK AS READY'}
                  </button>
                )}

                {order.status === 'READY' && (
                  <button 
                    style={{...s.actionBtn, ...s.btnDispatch}}
                    disabled={processingId === order.id}
                    onClick={() => handleStateTransition(order, 'DISPATCHED')}
                  >
                    {processingId === order.id ? 'PROCESSING...' : 'HAND TO RIDER (DISPATCH)'}
                  </button>
                )}
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT STYLES (Optimized for High-Stress Kitchen Tablets)
// ─────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  loading: { padding: '4rem', textAlign: 'center', color: 'var(--accent-sky)', fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif', fontSize: '1.5rem' },
  container: { padding: '2rem', maxWidth: '1600px', margin: '0 auto', width: '100%', animation: 'fade-in 0.4s ease-out' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', flexWrap: 'wrap', gap: '1.5rem' },
  h1: { margin: 0, fontSize: '2.5rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '-0.02em', fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif' },
  metrics: { display: 'flex', gap: '1rem' },
  metricBadge: { background: 'var(--bg-surface)', padding: '0.75rem 1.25rem', borderRadius: '8px', fontSize: '1rem', fontWeight: 700, border: 'var(--border-glass)', color: 'var(--text-primary)' },
  
  emptyState: { textAlign: 'center', padding: '6rem 2rem', background: 'var(--bg-surface)', borderRadius: '16px', border: '2px dashed rgba(255,255,255,0.1)', color: 'var(--text-primary)' },
  emptyIcon: { fontSize: '4rem', color: 'var(--accent-emerald)', marginBottom: '1rem' },

  pipelineGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '2rem' },
  
  orderCard: { 
    background: 'var(--bg-surface)', 
    borderRadius: '16px', 
    padding: '1.5rem', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '1.25rem',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
    borderTop: '6px solid transparent'
  },
  
  // Status-based color coding for peripheral vision recognition
  card_RECEIVED: { borderTopColor: 'var(--accent-critical)', backgroundColor: 'rgba(239, 68, 68, 0.05)' },
  card_PREPPING: { borderTopColor: 'var(--accent-warning)', backgroundColor: 'rgba(245, 158, 11, 0.05)' },
  card_READY: { borderTopColor: 'var(--accent-emerald)', backgroundColor: 'rgba(16, 185, 129, 0.05)' },

  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  brandBadge: { background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' },
  timeTracker: { fontSize: '1.125rem', color: 'var(--text-secondary)', fontFamily: 'monospace', fontWeight: 700 },
  
  orderId: { fontSize: '2.5rem', fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif', fontWeight: 700, color: 'var(--text-primary)', margin: '0.5rem 0' },
  
  itemList: { display: 'flex', flexDirection: 'column', gap: '0.75rem', flexGrow: 1, padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' },
  itemRow: { display: 'flex', alignItems: 'flex-start', gap: '1rem' },
  itemQty: { fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-sky)' },
  itemName: { fontSize: '1.125rem', color: 'var(--text-primary)', lineHeight: 1.3 },

  actionFooter: { marginTop: 'auto', paddingTop: '1rem' },
  
  // Massive touch targets for fast-paced physical environments
  actionBtn: { 
    width: '100%', 
    padding: '1.5rem', 
    border: 'none', 
    borderRadius: '8px', 
    fontSize: '1.125rem', 
    fontWeight: 800, 
    textTransform: 'uppercase', 
    cursor: 'pointer',
    color: '#000',
    transition: 'transform 0.1s, opacity 0.2s',
    letterSpacing: '0.05em'
  },
  
  btnPrepping: { background: 'var(--accent-warning)', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)' },
  btnReady: { background: 'var(--accent-emerald)', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)' },
  btnDispatch: { background: 'var(--accent-sky)', boxShadow: '0 4px 15px rgba(56, 189, 248, 0.3)' },
};
