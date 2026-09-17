
'use client';

import React, { useEffect, useState } from 'react';
import { getOrders, getInventory, addOrder } from '../lib/db';

export default function CommandCenter() {
  const [activeOrders, setActiveOrders] = useState<number>(0);
  const [pipelineRevenue, setPipelineRevenue] = useState<number>(0);
  const [inventoryAlerts, setInventoryAlerts] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(true);

  const loadTelemetry = async () => {
    try {
      const [orders, inventory] = await Promise.all([
        getOrders(),
        getInventory()
      ]);

      // Calculate unified dispatch pipeline metrics
      const active = orders.filter((o: any) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
      setActiveOrders(active.length);
      setPipelineRevenue(active.reduce((acc: number, o: any) => acc + (o.total || 0), 0));

      // Calculate algorithmic depletion matrix alerts
      const alerts = inventory.filter((i: any) => i.currentStock <= i.threshold);
      setInventoryAlerts(alerts.length);
    } catch (err) {
      console.error("Zero-latency state sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadTelemetry();
    
    // Establishing a fast polling loop for cross-tab IndexedDB synchronization 
    // In a production Edge environment, this validates our zero-latency state transfer
    const interval = setInterval(loadTelemetry, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSimulateOrder = async () => {
    const mockOrder = {
      id: `ORD-${Date.now().toString().slice(-6)}`,
      brand: 'Dark-Cloud Ghost Kitchen',
      items: [{ id: 'ITEM-1', name: 'Signature Cloud Burger', quantity: 1, price: 450 }],
      total: 450,
      status: 'PENDING',
      timestamp: Date.now()
    };
    
    await addOrder(mockOrder);
    await loadTelemetry();
  };

  // Institutional dark-void design system
  const s: { [key: string]: React.CSSProperties } = {
    container: { 
      padding: '2.5rem', 
      color: '#ededed', 
      backgroundColor: '#050505', 
      minHeight: '100vh', 
      fontFamily: 'system-ui, -apple-system, sans-serif' 
    },
    header: { 
      fontSize: '2.25rem', 
      fontWeight: 700, 
      marginBottom: '2rem', 
      letterSpacing: '-0.03em',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    statusIndicator: {
      fontSize: '0.875rem',
      fontWeight: 500,
      color: isSyncing ? '#a1a1aa' : '#10b981',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    grid: { 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
      gap: '1.5rem', 
      marginBottom: '3rem' 
    },
    kpiCard: { 
      padding: '1.5rem', 
      backgroundColor: '#111111', 
      border: '1px solid #262626', 
      borderRadius: '8px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
    },
    kpiLabel: { 
      fontSize: '0.75rem', 
      color: '#a1a1aa', 
      textTransform: 'uppercase', 
      letterSpacing: '0.1em', 
      marginBottom: '0.75rem' 
    },
    kpiValue: { 
      fontSize: '3rem', 
      fontWeight: 800, 
      fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      lineHeight: '1.2'
    },
    kpiSub: { 
      fontSize: '0.875rem', 
      color: '#71717a', 
      marginTop: '0.5rem' 
    },
    button: { 
      padding: '0.875rem 1.5rem', 
      backgroundColor: '#ededed', 
      color: '#000', 
      border: 'none', 
      borderRadius: '6px', 
      fontWeight: 600, 
      fontSize: '0.875rem',
      cursor: 'pointer',
      transition: 'opacity 0.2s ease'
    }
  };

  return (
    <div style={s.container}>
      <div style={s.header}>
        Dark-Cloud Command Center
        <span style={s.statusIndicator}>
          <span style={{ 
            display: 'inline-block', 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            backgroundColor: isSyncing ? '#f59e0b' : '#10b981' 
          }} />
          {isSyncing ? 'SYNCING STATE...' : 'INDEXED_DB ONLINE'}
        </span>
      </div>

      <div style={s.grid}>
        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>Active Pipeline</div>
          <div style={s.kpiValue}>{activeOrders}</div>
          <div style={s.kpiSub}>Tickets in Unified Dispatch</div>
        </div>
        
        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>Pipeline Revenue</div>
          <div style={s.kpiValue}>₹{pipelineRevenue.toLocaleString()}</div>
          <div style={s.kpiSub}>Unrealized Gross (INR)</div>
        </div>
        
        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>Algorithmic Depletion Alerts</div>
          {/* CRITICAL FIX: Merged style object to prevent JSX duplicate attribute compiler failure */}
          <div style={{ 
            ...s.kpiValue, 
            color: inventoryAlerts > 0 ? '#ef4444' : '#10b981' 
          }}>
            {inventoryAlerts}
          </div>
          <div style={s.kpiSub}>Action Required on Stock</div>
        </div>
      </div>

      <button 
        style={s.button} 
        onClick={handleSimulateOrder}
        onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
        onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
      >
        [ SIMULATE INBOUND API INJECTION ]
      </button>
    </div>
  );
}
