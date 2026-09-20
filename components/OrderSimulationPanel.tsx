

"use client";

import React, { useState } from 'react';
import {
  BRANDS_DB,
  MENU_CATALOG,
  DbaBrand,
  OrderChannel,
  Order,
} from '@/lib/db';

interface OrderSimulationPanelProps {
  onInject: (newOrder: Order) => void;
}

export default function OrderSimulationPanel({ onInject }: OrderSimulationPanelProps) {
  const [selectedBrand, setSelectedBrand] = useState<DbaBrand>('BurgerForge');
  const [selectedChannel, setSelectedChannel] = useState<OrderChannel>('DoorDash');
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>('MENU-BF-01');
  const [quantity, setQuantity] = useState<number>(1);
  const [customNotes, setCustomNotes] = useState<string>('');

  const brandMenuItems = MENU_CATALOG.filter((item) => item.brandId === selectedBrand);

  const handleBrandChange = (brand: DbaBrand) => {
    setSelectedBrand(brand);
    const firstItem = MENU_CATALOG.find((item) => item.brandId === brand);
    if (firstItem) {
      setSelectedMenuItemId(firstItem.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const menuItem = MENU_CATALOG.find((m) => m.id === selectedMenuItemId);
    if (!menuItem) return;

    const newOrder: Order = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      brandId: selectedBrand,
      channel: selectedChannel,
      status: 'PENDING',
      items: [
        {
          id: `item-${Date.now()}`,
          menuItemId: menuItem.id,
          name: menuItem.name,
          quantity: quantity,
          notes: customNotes || undefined,
          station: menuItem.station,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onInject(newOrder);
    setCustomNotes('');
  };

  return (
    <div className="bg-gray-900 border border-sky-500/30 rounded-xl p-5 text-white font-sans">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
          <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-sky-400">
            ⚡ Mock Order Injector & Real-Time Depletion Engine
          </h2>
        </div>
        <span className="text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded">
          POS Simulation
        </span>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-mono text-gray-400 mb-1 uppercase">1. Select Brand DBA</label>
          <select
            value={selectedBrand}
            onChange={(e) => handleBrandChange(e.target.value as DbaBrand)}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-xs font-mono text-white outline-none focus:border-sky-500"
          >
            {Object.values(BRANDS_DB).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-mono text-gray-400 mb-1 uppercase">2. Order Channel</label>
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value as OrderChannel)}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-xs font-mono text-white outline-none focus:border-sky-500"
          >
            <option value="DoorDash">DoorDash</option>
            <option value="UberEats">UberEats</option>
            <option value="GrubHub">GrubHub</option>
            <option value="Direct Web">Direct Web</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-mono text-gray-400 mb-1 uppercase">3. Menu Item</label>
          <select
            value={selectedMenuItemId}
            onChange={(e) => setSelectedMenuItemId(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-xs font-mono text-white outline-none focus:border-sky-500"
          >
            {brandMenuItems.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} (\${m.price.toFixed(2)}) - [{m.station}]
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-mono text-gray-400 mb-1 uppercase">Quantity</label>
          <input
            type="number"
            min={1}
            max={10}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-xs font-mono text-white outline-none focus:border-sky-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-mono text-gray-400 mb-1 uppercase">Custom Preparation Notes</label>
          <input
            type="text"
            placeholder="e.g. Extra sauce, no pickles, allergen warning"
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-xs font-mono text-white outline-none focus:border-sky-500"
          />
        </div>

        <div className="md:col-span-3 flex justify-end">
          <button
            type="submit"
            className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-mono font-bold px-6 py-2.5 rounded-lg text-xs uppercase tracking-wider transition-all"
          >
            Inject Order into Kitchen Pipeline →
          </button>
        </div>
      </form>
    </div>
  );
}
