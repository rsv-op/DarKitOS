'use client';

import React, { useState, useEffect } from 'react';
import { getInventory, initDefaultInventory, InventoryItem } from '../../lib/db';


export default function UnifiedDispatch() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(true);

  const fetchOrders = async () => {
    try {
      const data = await getOrders();
      // Filter out completed/cancelled to keep the Kanban clean, sort by oldest first
      const activeOrders = data
        .filter(o => o.status === 'PENDING' || o.status === 'PREPPING')
        .sort((a, b) => a.timestamp - b.timestamp);
      
      setOrders(activeOrders);
    } catch (err) {
      console.error('State sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Zero-latency cross-tab synchronization polling
    const interval = setInterval(fetchOrders, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleStatusAdvance = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'PENDING' ? 'PREPPING' : 'COMPLETED';
    await updateOrderStatus(id, nextStatus);
    await fetchOrders();
  };

  const s: { [key: string]: React.CSSProperties } = {
    container: { padding: '2.5rem', color: '#ededed', backgroundColor: '#050505', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' },
    header: { fontSize: '2.25rem', fontWeight: 700, marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' },
    ticket: { padding: '1.5rem', backgroundColor: '#111111', border: '1px solid #262626', borderRadius: '8px', display: 'flex', flexDirection: 'column' },
    ticketHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #262626', paddingBottom: '0.75rem' },
    brand: { fontSize: '0.75rem', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' },
    status: { fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: '4px' },
    itemList: { flexGrow: 1, marginBottom: '1.5rem' },
    item: { display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.5rem' },
    button: { padding: '0.75rem', backgroundColor: '#ededed', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }
  };

  return (
    <div style={s.container}>
      <div style={s.header}>
        Unified Dispatch Pipeline
        <span style={{ fontSize: '0.875rem', color: isSyncing ? '#a1a1aa' : '#10b981' }}>
          {isSyncing ? 'SYNCING...' : 'LIVE'}
        </span>
      </div>
      
      <div style={s.grid}>
        {orders.length === 0 ? (
          <div style={{ color: '#71717a' }}>No active tickets in pipeline.</div>
        ) : (
          orders.map((order) => (
            <div key={order.id} style={s.ticket}>
              <div style={s.ticketHeader}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>{order.id}</div>
                  <div style={s.brand}>{order.brand}</div>
                </div>
                <div style={{
                  ...s.status,
                  backgroundColor: order.status === 'PENDING' ? '#f59e0b' : '#3b82f6',
                  color: '#fff'
                }}>
                  {order.status}
                </div>
              </div>
              
              <div style={s.itemList}>
                {order.items.map((item, idx) => (
                  <div key={idx} style={s.item}>
                    <span>{item.quantity}x {item.name}</span>
                  </div>
                ))}
              </div>

              <button 
                style={s.button} 
                onClick={() => handleStatusAdvance(order.id, order.status)}
              >
                {order.status === 'PENDING' ? 'START PREPPING' : 'MARK COMPLETED'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
