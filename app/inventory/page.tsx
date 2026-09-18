'use client';

import React, { useEffect, useState } from 'react';
import { getInventory, initDefaultInventory, InventoryItem } from '../lib/db';

export default function AlgorithmicDepletionMatrix() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(true);

  const fetchInventory = async () => {
    try {
      // Ensure DB is seeded if this is the first page loaded
      await initDefaultInventory();
      const currentStock = await getInventory();
      
      // Sort critical items to the top using the corrected reorderThreshold property
      currentStock.sort((a, b) => {
        const aCritical = a.currentStock <= a.reorderThreshold ? -1 : 1;
        const bCritical = b.currentStock <= b.reorderThreshold ? -1 : 1;
        if (aCritical !== bCritical) return aCritical - bCritical;
        return (a.currentStock / a.reorderThreshold) - (b.currentStock / b.reorderThreshold);
      });
      
      setInventory(currentStock);
    } catch (err) {
      console.error('State sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchInventory();
    // Zero-latency cross-tab synchronization polling
    const interval = setInterval(fetchInventory, 1000);
    return () => clearInterval(interval);
  }, []);

  const s: { [key: string]: React.CSSProperties } = {
    container: { padding: '2.5rem', color: '#ededed', backgroundColor: '#050505', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' },
    header: { fontSize: '2.25rem', fontWeight: 700, marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' },
    card: { padding: '1.5rem', backgroundColor: '#111111', border: '1px solid #262626', borderRadius: '8px' },
    cardTitle: { fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' },
    metric: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' },
    alertBadge: { backgroundColor: '#ef4444', color: '#fff', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-block', marginTop: '1rem' }
  };

  return (
    <div style={s.container}>
      <div style={s.header}>
        Algorithmic Depletion Matrix
        <span style={{ fontSize: '0.875rem', color: isSyncing ? '#a1a1aa' : '#10b981' }}>
          {isSyncing ? 'SYNCING...' : 'LIVE'}
        </span>
      </div>
      <div style={s.grid}>
        {inventory.map((item) => {
          const isCritical = item.currentStock <= item.reorderThreshold;
          return (
            <div key={item.id} style={{ ...s.card, borderColor: isCritical ? '#ef4444' : '#262626' }}>
              <div style={s.cardTitle}>{item.name}</div>
              <div style={s.metric}>
                <span style={{ color: '#a1a1aa' }}>Current Stock:</span>
                <span style={{ fontWeight: 700, color: isCritical ? '#ef4444' : '#10b981' }}>
                  {item.currentStock} {item.unit}
                </span>
              </div>
              <div style={s.metric}>
                <span style={{ color: '#a1a1aa' }}>Reorder Threshold:</span>
                <span>{item.reorderThreshold} {item.unit}</span>
              </div>
              {isCritical && <div style={s.alertBadge}>CRITICAL LOW STOCK</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
