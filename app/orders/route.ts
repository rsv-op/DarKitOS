
"use client";

import React, { useState, useMemo } from 'react';
import OrderSimulationPanel from '@/components/OrderSimulationPanel';
import {
  INVENTORY_DB,
  DbaBrand,
  InventoryItem,
  Order,
  processOrderDepletion,
} from '@/lib/db';

const MOCK_INITIAL_ORDERS: Order[] = [
  {
    id: 'ORD-8801',
    brandId: 'BurgerForge',
    channel: 'DoorDash',
    status: 'PREPARING',
    items: [
      { id: 'item-1', menuItemId: 'MENU-BF-01', name: 'Double Smash Burger', quantity: 2, station: 'Grill' },
      { id: 'item-2', menuItemId: 'MENU-BF-02', name: 'Truffle Fries', quantity: 1, station: 'Fryer' },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ORD-8802',
    brandId: 'TacoMatrix',
    channel: 'UberEats',
    status: 'READY_FOR_PICKUP',
    items: [
      { id: 'item-3', menuItemId: 'MENU-TM-01', name: 'Birria Taco Trio', quantity: 1, station: 'Assembly' },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function OwnerCommandPage() {
  const [showInjector, setShowInjector] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>(INVENTORY_DB);
  const [orders, setOrders] = useState<Order[]>(MOCK_INITIAL_ORDERS);
  const [activeBrandFilter, setActiveBrandFilter] = useState<string>('ALL');

  const { totalRevenue, activeOrdersCount, avgPrepTimeMins, brandMetrics, lowStockItems } = useMemo(() => {
    let totalRev = 0;
    let activeCount = 0;
    let totalPrepMins = 0;
    let completedPrepCount = 0;

    const brandStats: Record<DbaBrand, { name: string; revenue: number; orderCount: number; color: string }> = {
      BurgerForge: { name: 'BurgerForge', revenue: 1240.0, orderCount: 42, color: 'text-amber-400 border-amber-500/30' },
      TacoMatrix: { name: 'TacoMatrix', revenue: 890.5, orderCount: 31, color: 'text-emerald-400 border-emerald-500/30' },
      WingProtocol: { name: 'WingProtocol', revenue: 750.0, orderCount: 25, color: 'text-red-400 border-red-500/30' },
      GreenBowl: { name: 'GreenBowl', revenue: 540.0, orderCount: 18, color: 'text-cyan-400 border-cyan-500/30' },
    };

    orders.forEach((o) => {
      if (o.status !== 'DISPATCHED' && o.status !== 'CANCELLED') {
        activeCount++;
      }

      const elapsed = (Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60);
      totalPrepMins += elapsed;
      completedPrepCount++;

      const orderVal = o.items.length * 14.5;
      brandStats[o.brandId].revenue += orderVal;
      brandStats[o.brandId].orderCount += 1;
    });

    Object.values(brandStats).forEach((b) => {
      totalRev += b.revenue;
    });

    const avgPrep = completedPrepCount > 0 ? (totalPrepMins / completedPrepCount).toFixed(1) : '0.0';
    const lowStock = inventory.filter((item) => item.currentStock <= item.reorderThreshold);

    return {
      totalRevenue: totalRev,
      activeOrdersCount: activeCount,
      avgPrepTimeMins: avgPrep,
      brandMetrics: brandStats,
      lowStockItems: lowStock,
    };
  }, [orders, inventory]);

  const handleSimulatedOrder = (newOrder: Order) => {
    setOrders((prev) => [newOrder, ...prev]);
    const { updatedInventory } = processOrderDepletion(newOrder, inventory);
    setInventory(updatedInventory);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-800 pb-4 mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono tracking-tight text-white">Owner Command Center</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Single Kitchen / 4 DBAs
            </span>
          </div>
          <p className="text-gray-400 text-xs mt-1">Cross-Brand Aggregated Metrics & Real-time Inventory Depletion Engine</p>
        </div>

        <button
          onClick={() => setShowInjector(!showInjector)}
          className="bg-sky-500 hover:bg-sky-400 text-gray-950 font-mono font-bold text-xs px-4 py-2.5 rounded-xl uppercase tracking-wider transition-all"
        >
          {showInjector ? 'Close Mock Order Injector' : '⚡ Open Mock Order Injector'}
        </button>
      </header>

      {showInjector && (
        <div className="mb-8 p-6 bg-gray-900 border border-sky-500/30 rounded-2xl shadow-2xl">
          <OrderSimulationPanel onInject={handleSimulatedOrder} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-gray-400 text-xs font-mono mb-1 uppercase">Active Facility Orders</div>
          <div className="text-3xl font-mono font-bold text-white">{activeOrdersCount}</div>
          <div className="text-xs text-emerald-400 font-mono mt-2">↑ Live KDS Queue Sync</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-gray-400 text-xs font-mono mb-1 uppercase">Avg Kitchen Prep Time</div>
          <div className="text-3xl font-mono font-bold text-amber-400">
            {avgPrepTimeMins} <span className="text-sm text-gray-500 font-normal">mins</span>
          </div>
          <div className="text-xs text-emerald-400 font-mono mt-2">SLA Target: &lt; 8.0 mins</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-gray-400 text-xs font-mono mb-1 uppercase">Gross Facility Revenue</div>
          <div className="text-3xl font-mono font-bold text-emerald-400">
            \${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-400 font-mono mt-2">Aggregated Across 4 DBAs</div>
        </div>

        <div className={`bg-gray-900 border rounded-xl p-5 ${lowStockItems.length > 0 ? 'border-red-900/50 bg-red-950/10' : 'border-gray-800'}`}>
          <div className="text-red-400 text-xs font-mono mb-1 uppercase">Critical Inventory Alerts</div>
          <div className="text-3xl font-mono font-bold text-red-400">{lowStockItems.length} <span className="text-xs text-gray-400 font-normal">items low</span></div>
          <div className="text-xs text-red-300 font-mono mt-2 truncate">
            {lowStockItems.length > 0 ? lowStockItems.map((i) => i.name).join(', ') : 'All Stock Nominal'}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold font-mono text-gray-200">4 DBA Brand Performance Breakdown</h2>
        <div className="flex gap-2">
          {['ALL', 'BurgerForge', 'TacoMatrix', 'WingProtocol', 'GreenBowl'].map((b) => (
            <button
              key={b}
              onClick={() => setActiveBrandFilter(b)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                activeBrandFilter === b
                  ? 'bg-sky-500 text-gray-950 font-bold'
                  : 'bg-gray-900 text-gray-400 border border-gray-800 hover:border-gray-700'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Object.values(brandMetrics)
          .filter((b) => activeBrandFilter === 'ALL' || b.name === activeBrandFilter)
          .map((brand) => (
            <div key={brand.name} className={`bg-gray-900 border ${brand.color} rounded-xl p-5`}>
              <div className="flex justify-between items-center mb-2">
                <span className={`text-sm font-bold font-mono ${brand.color.split(' ')}`}>{brand.name}</span>
                <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">DBA ACTIVE</span>
              </div>
              <div className="text-2xl font-mono font-bold text-white">
                \${brand.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-gray-400 font-mono mt-1">{brand.orderCount} Orders Completed Today</div>
            </div>
          ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">Live Inventory Depletion Ledger</h3>
          <span className="text-xs font-mono text-gray-500">Real-time Stock Deductions</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 uppercase">
                <th className="pb-3">SKU</th>
                <th className="pb-3">Item Name</th>
                <th className="pb-3">Category</th>
                <th className="pb-3">Stock Level</th>
                <th className="pb-3">Reorder Threshold</th>
                <th className="pb-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {inventory.map((item) => {
                const isLow = item.currentStock <= item.reorderThreshold;
                return (
                  <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 text-gray-400">{item.sku}</td>
                    <td className="py-3 text-white font-semibold">{item.name}</td>
                    <td className="py-3 text-gray-400">{item.category}</td>
                    <td className={`py-3 font-bold ${isLow ? 'text-red-400' : 'text-emerald-400'}`}>
                      {item.currentStock} {item.unit}
                    </td>
                    <td className="py-3 text-gray-500">{item.reorderThreshold} {item.unit}</td>
                    <td className="py-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isLow ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                        {isLow ? 'REORDER NOW' : 'NOMINAL'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
