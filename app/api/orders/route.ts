
"use client";

import React, { useState } from 'react';
import { Order, OrderStatus } from '@/lib/db';

const MOCK_PIPELINE_ORDERS: Order[] = [
  {
    id: 'ORD-8801',
    brandId: 'BurgerForge',
    channel: 'DoorDash',
    status: 'PREPARING',
    customerName: 'Sarah K.',
    items: [
      { id: 'i-1', menuItemId: 'MENU-BF-01', name: 'Double Smash Burger', quantity: 2, station: 'Grill', notes: 'Extra Pickles' },
      { id: 'i-2', menuItemId: 'MENU-BF-02', name: 'Truffle Fries', quantity: 1, station: 'Fryer' },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ORD-8802',
    brandId: 'TacoMatrix',
    channel: 'UberEats',
    status: 'READY_FOR_PICKUP',
    customerName: 'Alex M.',
    driverName: 'Carlos R.',
    items: [
      { id: 'i-3', menuItemId: 'MENU-TM-01', name: 'Birria Taco Trio', quantity: 1, station: 'Assembly' },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ORD-8803',
    brandId: 'WingProtocol',
    channel: 'GrubHub',
    status: 'PENDING',
    customerName: 'David L.',
    items: [
      { id: 'i-4', menuItemId: 'MENU-WP-01', name: '12pc Ghost Pepper Wings', quantity: 1, station: 'Fryer' },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ORD-8804',
    brandId: 'GreenBowl',
    channel: 'Direct Web',
    status: 'DISPATCHED',
    customerName: 'Elena P.',
    items: [
      { id: 'i-5', menuItemId: 'MENU-GB-01', name: 'Ahi Tuna Poke Bowl', quantity: 2, station: 'Cold Prep' },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const STAGES: { status: OrderStatus; label: string; color: string }[] = [
  { status: 'PENDING', label: '1. Pending', color: 'border-amber-500/30 text-amber-400 bg-amber-500/10' },
  { status: 'PREPARING', label: '2. Kitchen Prepping', color: 'border-sky-500/30 text-sky-400 bg-sky-500/10' },
  { status: 'READY_FOR_PICKUP', label: '3. Ready for Courier', color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' },
  { status: 'DISPATCHED', label: '4. Dispatched', color: 'border-gray-700 text-gray-400 bg-gray-900' },
];

export default function OrdersPipelinePage() {
  const [orders, setOrders] = useState
