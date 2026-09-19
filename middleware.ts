```typescript
// File: middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/api/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
  ) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get('dark_cloud_session')?.value;

  if (!authCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

```tsx
// File: app/login/page.tsx
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

const STATIONS = [
  { role: 'cook', name: 'Cook Station', route: '/cook', color: 'border-amber-500/50 text-amber-400' },
  { role: 'dispatch', name: 'Dispatch / FOH', route: '/dispatch', color: 'border-sky-500/50 text-sky-400' },
  { role: 'owner', name: 'Owner Command', route: '/owner', color: 'border-emerald-500/50 text-emerald-400' },
];

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [selectedStation, setSelectedStation] = useState('owner');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
      setError('');
    }
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }

    setLoading(true);

    if (pin === '9999' || pin === '1234' || pin === '5555') {
      document.cookie = `dark_cloud_session=${selectedStation}_${pin}; path=/; max-age=86400; SameSite=Lax`;
      const targetRoute = STATIONS.find((s) => s.role === selectedStation)?.route || '/owner';
      router.push(targetRoute);
    } else {
      setError('Invalid Station PIN. Master Bypass: 9999');
      setLoading(false);
      setPin('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col justify-center items-center p-4 font-sans">
      <div className="w-full max-w-md bg-gray-900/90 border border-gray-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-mono font-semibold uppercase tracking-wider mb-2">
            Dark-Cloud Kitchen OS
          </div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-white">Universal Station Gatekeeper</h1>
          <p className="text-gray-400 text-xs mt-1">4-DBA Single Facility Authentication</p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6">
          {STATIONS.map((s) => (
            <button
              key={s.role}
              type="button"
              onClick={() => setSelectedStation(s.role)}
              className={`p-2.5 rounded-xl border text-xs font-semibold font-mono transition-all text-center ${
                selectedStation === s.role
                  ? `\${s.color} bg-gray-800/80 shadow-lg scale-[1.02]`
                  : 'border-gray-800 text-gray-400 hover:border-gray-700 bg-gray-950/50'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 mb-6 text-center">
          <div className="flex justify-center gap-3">
            {.map((idx) => (
              <div
                key={idx}
                className={`w-10 h-12 rounded-lg border flex items-center justify-center font-mono text-xl font-bold transition-all ${
                  pin[idx]
                    ? 'border-sky-400 text-sky-400 bg-sky-500/10 shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                    : 'border-gray-800 text-gray-600 bg-gray-900/40'
                }`}
              >
                {pin[idx] ? '●' : ''}
              </div>
            ))}
          </div>
          {error && <p className="text-red-400 text-xs mt-3 font-mono">{error}</p>}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeyPress(digit)}
              className="h-12 bg-gray-800/60 hover:bg-gray-700/80 border border-gray-700/50 rounded-xl text-lg font-bold font-mono text-white transition-all active:scale-95"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-12 bg-red-950/30 hover:bg-red-900/40 border border-red-800/40 rounded-xl text-xs font-bold font-mono text-red-400 transition-all active:scale-95 uppercase"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="h-12 bg-gray-800/60 hover:bg-gray-700/80 border border-gray-700/50 rounded-xl text-lg font-bold font-mono text-white transition-all active:scale-95"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleLogin()}
            disabled={loading}
            className="h-12 bg-emerald-500 hover:bg-emerald-400 border border-emerald-400 rounded-xl text-xs font-bold font-mono text-gray-950 transition-all active:scale-95 uppercase tracking-wider"
          >
            {loading ? '...' : 'Enter'}
          </button>
        </div>

        <div className="text-center text-[10px] text-gray-500 font-mono">
          Master Dev Bypass PIN: <span className="text-gray-400 font-bold">9999</span>
        </div>
      </div>
    </div>
  );
}
```

```tsx
// File: app/cook/page.tsx
"use client";

import React, { useState } from 'react';

interface CookTicket {
  id: string;
  brand: 'BurgerForge' | 'TacoMatrix' | 'WingProtocol' | 'GreenBowl';
  brandColor: string;
  items: { name: string; qty: number; notes?: string }[];
  station: 'Grill' | 'Fryer' | 'Assembly' | 'Cold Prep';
  status: 'PENDING' | 'PREPARING' | 'READY';
  elapsedMins: number;
}

const INITIAL_TICKETS: CookTicket[] = [
  {
    id: 'ORD-8801',
    brand: 'BurgerForge',
    brandColor: 'border-amber-500 bg-amber-500/10 text-amber-400',
    items: [
      { name: 'Double Smash Burger', qty: 2, notes: 'Extra Pickles' },
      { name: 'Truffle Fries', qty: 1 },
    ],
    station: 'Grill',
    status: 'PREPARING',
    elapsedMins: 4,
  },
  {
    id: 'ORD-8802',
    brand: 'TacoMatrix',
    brandColor: 'border-emerald-500 bg-emerald-500/10 text-emerald-400',
    items: [
      { name: 'Birria Taco Trio', qty: 1, notes: 'Consomé extra' },
      { name: 'Churro Bites', qty: 2 },
    ],
    station: 'Assembly',
    status: 'PENDING',
    elapsedMins: 1,
  },
  {
    id: 'ORD-8803',
    brand: 'WingProtocol',
    brandColor: 'border-red-500 bg-red-500/10 text-red-400',
    items: [
      { name: '12pc Ghost Pepper Wings', qty: 1 },
      { name: 'Garlic Parmesan Fries', qty: 1 },
    ],
    station: 'Fryer',
    status: 'PREPARING',
    elapsedMins: 8,
  },
  {
    id: 'ORD-8804',
    brand: 'GreenBowl',
    brandColor: 'border-cyan-500 bg-cyan-500/10 text-cyan-400',
    items: [
      { name: 'Ahi Tuna Poke Bowl', qty: 2, notes: 'No Mayonnaise' },
    ],
    station: 'Cold Prep',
    status: 'PENDING',
    elapsedMins: 2,
  },
];

export default function CookStationPage() {
  const [tickets, setTickets] = useState<CookTicket[]>(INITIAL_TICKETS);
  const [activeStationFilter, setActiveStationFilter] = useState<string>('ALL');

  const advanceStatus = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId) return t;
        const nextStatus = t.status === 'PENDING' ? 'PREPARING' : t.status === 'PREPARING' ? 'READY' : 'READY';
        return { ...t, status: nextStatus };
      })
    );
  };

  const filteredTickets = activeStationFilter === 'ALL'
    ? tickets
    : tickets.filter((t) => t.station === activeStationFilter);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-800 pb-4 mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono tracking-tight text-white">Cook Station Kitchen Display System</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Kitchen KDS
            </span>
          </div>
          <p className="text-gray-400 text-xs mt-1">Multi-DBA Order Execution Engine (4 Brands, 1 Facility)</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {['ALL', 'Grill', 'Fryer', 'Assembly', 'Cold Prep'].map((st) => (
            <button
              key={st}
              onClick={() => setActiveStationFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                activeStationFilter === st
                  ? 'bg-sky-500 text-gray-950 font-bold'
                  : 'bg-gray-900 text-gray-400 border border-gray-800 hover:border-gray-700'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredTickets.map((t) => (
          <div
            key={t.id}
            className={`bg-gray-900 border rounded-xl p-5 flex flex-col justify-between transition-all ${
              t.status === 'READY'
                ? 'border-emerald-500/40 opacity-60'
                : t.elapsedMins > 6
                ? 'border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                : 'border-gray-800'
            }`}
          >
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold border ${t.brandColor}`}>
                  {t.brand}
                </span>
                <span className="font-mono text-xs text-gray-400">{t.id}</span>
              </div>

              <div className="flex justify-between items-center text-xs font-mono text-gray-400 mb-4 pb-2 border-b border-gray-800">
                <span>Station: <strong className="text-white">{t.station}</strong></span>
                <span className={`font-bold ${t.elapsedMins > 6 ? 'text-red-400 animate-pulse' : 'text-gray-300'}`}>
                  ⏱ {t.elapsedMins}m
                </span>
              </div>

              <ul className="space-y-3 mb-6">
                {t.items.map((item, idx) => (
                  <li key={idx} className="flex justify-between items-start text-sm">
                    <div>
                      <span className="font-bold text-white">{item.qty}x</span>{' '}
                      <span className="text-gray-200">{item.name}</span>
                      {item.notes && (
                        <p className="text-xs text-amber-400/90 font-mono italic mt-0.5">⚠️ {item.notes}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => advanceStatus(t.id)}
              disabled={t.status === 'READY'}
              className={`w-full py-2.5 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                t.status === 'PENDING'
                  ? 'bg-amber-500 hover:bg-amber-400 text-gray-950'
                  : t.status === 'PREPARING'
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-gray-950'
                  : 'bg-gray-800 text-gray-500 cursor-default'
              }`}
            >
              {t.status === 'PENDING'
                ? 'Start Prep →'
                : t.status === 'PREPARING'
                ? 'Mark Ready ✓'
                : 'Completed'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

```tsx
// File: app/dispatch/page.tsx
"use client";

import React, { useState } from 'react';

interface DispatchOrder {
  id: string;
  brand: string;
  channel: 'DoorDash' | 'UberEats' | 'GrubHub' | 'Direct Web';
  itemsCount: number;
  driverName?: string;
  status: 'PREPARING' | 'READY_FOR_PICKUP' | 'DISPATCHED';
  courierEtaMins: number;
}

const INITIAL_DISPATCH_ORDERS: DispatchOrder[] = [
  { id: 'ORD-8801', brand: 'BurgerForge', channel: 'DoorDash', itemsCount: 3, driverName: 'Marcus T.', status: 'PREPARING', courierEtaMins: 3 },
  { id: 'ORD-8802', brand: 'TacoMatrix', channel: 'UberEats', itemsCount: 3, driverName: 'Sarah K.', status: 'READY_FOR_PICKUP', courierEtaMins: 1 },
  { id: 'ORD-8803', brand: 'WingProtocol', channel: 'GrubHub', itemsCount: 2, status: 'PREPARING', courierEtaMins: 7 },
  { id: 'ORD-8804', brand: 'GreenBowl', channel: 'Direct Web', itemsCount: 2, driverName: 'David L.', status: 'READY_FOR_PICKUP', courierEtaMins: 2 },
];

export default function DispatchPage() {
  const [orders, setOrders] = useState<DispatchOrder[]>(INITIAL_DISPATCH_ORDERS);

  const markDispatched = (id: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: 'DISPATCHED' } : o))
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans">
      <header className="flex justify-between items-center border-b border-gray-800 pb-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono tracking-tight text-white">Unified Front-of-House Dispatch</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
              Courier Staging
            </span>
          </div>
          <p className="text-gray-400 text-xs mt-1">Multi-Channel Courier Aggregation & Driver Verification</p>
        </div>

        <div className="text-right font-mono text-xs text-gray-400">
          <div>Active Queue: <strong className="text-white">{orders.filter(o => o.status !== 'DISPATCHED').length}</strong></div>
          <div className="text-emerald-400 font-semibold">Ready for Driver: {orders.filter(o => o.status === 'READY_FOR_PICKUP').length}</div>
        </div>
      </header>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-gray-950/80 border-b border-gray-800 text-gray-400 font-mono text-xs uppercase">
              <th className="p-4">Order Ref</th>
              <th className="p-4">DBA Brand</th>
              <th className="p-4">Channel</th>
              <th className="p-4">Items</th>
              <th className="p-4">Assigned Driver</th>
              <th className="p-4">Courier ETA</th>
              <th className="p-4">KDS Status</th>
              <th className="p-4 text-right">Dispatch Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60 font-mono">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-800/40 transition-colors">
                <td className="p-4 font-bold text-sky-400">{o.id}</td>
                <td className="p-4 text-white font-semibold">{o.brand}</td>
                <td className="p-4 text-gray-300">
                  <span className="bg-gray-800 px-2 py-0.5 rounded text-xs border border-gray-700">
                    {o.channel}
                  </span>
                </td>
                <td className="p-4 text-gray-400">{o.itemsCount} Items</td>
                <td className="p-4 text-gray-200">{o.driverName || <span className="text-gray-600 italic">Unassigned</span>}</td>
                <td className="p-4 text-amber-400 font-bold">{o.courierEtaMins}m</td>
                <td className="p-4">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                      o.status === 'READY_FOR_PICKUP'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : o.status === 'PREPARING'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-gray-800 text-gray-500 border-gray-700'
                    }`}
                  >
                    {o.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="p-4 text-right">
                  {o.status === 'READY_FOR_PICKUP' ? (
                    <button
                      onClick={() => markDispatched(o.id)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider transition-all"
                    >
                      Hand Off →
                    </button>
                  ) : o.status === 'DISPATCHED' ? (
                    <span className="text-gray-500 text-xs">Dispatched</span>
                  ) : (
                    <span className="text-gray-600 text-xs italic">Awaiting Cook KDS</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

```tsx
// File: app/owner/page.tsx
"use client";

import React, { useState } from 'react';
import OrderSimulationPanel from '@/components/OrderSimulationPanel';

export default function OwnerCommandPage() {
  const [showInjector, setShowInjector] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-800 pb-4 mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono tracking-tight text-white">Dark-Cloud OS Command Center</h1>
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
          <OrderSimulationPanel />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-gray-400 text-xs font-mono mb-1 uppercase">Active Facility Orders</div>
          <div className="text-3xl font-mono font-bold text-white">12</div>
          <div className="text-xs text-emerald-400 font-mono mt-2">↑ 18% vs Yesterday</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-gray-400 text-xs font-mono mb-1 uppercase">Avg Kitchen Prep Time</div>
          <div className="text-3xl font-mono font-bold text-amber-400">6.4 <span className="text-sm text-gray-500 font-normal">mins</span></div>
          <div className="text-xs text-emerald-400 font-mono mt-2">Target: &lt; 8.0 mins</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-gray-400 text-xs font-mono mb-1 uppercase">Gross Daily Revenue</div>
          <div className="text-3xl font-mono font-bold text-emerald-400">\$3,420.50</div>
          <div className="text-xs text-gray-400 font-mono mt-2">4 DBA Aggregated</div>
        </div>

        <div className="bg-gray-900 border border-red-900/50 rounded-xl p-5 bg-red-950/10">
          <div className="text-red-400 text-xs font-mono mb-1 uppercase">Critical Inventory Alerts</div>
          <div className="text-3xl font-mono font-bold text-red-400">2 <span className="text-xs text-gray-400 font-normal">items low</span></div>
          <div className="text-xs text-red-300 font-mono mt-2">Brioche Buns & Ghost Pepper Sauce</div>
        </div>
      </div>

      <h2 className="text-lg font-bold font-mono text-gray-200 mb-4">4 DBA Brand Performance Breakdown</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { name: 'BurgerForge', revenue: '\$1,240.00', orders: 42, color: 'text-amber-400', border: 'border-amber-500/30' },
          { name: 'TacoMatrix', revenue: '\$890.50', orders: 31, color: 'text-emerald-400', border: 'border-emerald-500/30' },
          { name: 'WingProtocol', revenue: '\$750.00', orders: 25, color: 'text-red-400', border: 'border-red-500/30' },
          { name: 'GreenBowl', revenue: '\$540.00', orders: 18, color: 'text-cyan-400', border: 'border-cyan-500/30' },
        ].map((brand) => (
          <div key={brand.name} className={`bg-gray-900 border ${brand.border} rounded-xl p-5`}>
            <div className={`text-sm font-bold font-mono ${brand.color} mb-2`}>{brand.name}</div>
            <div className="text-xl font-mono font-bold text-white">{brand.revenue}</div>
            <div className="text-xs text-gray-400 font-mono mt-1">{brand.orders} Orders Completed Today</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

```tsx
// File: components/OrderSimulationPanel.tsx
"use client";

import React, { useState } from 'react';

const BRANDS = [
  {
    id: 'BurgerForge',
    name: 'BurgerForge',
    items: ['Double Smash Burger', 'Truffle Fries', 'Brioche Milkshake'],
  },
  {
    id: 'TacoMatrix',
    name: 'TacoMatrix',
    items: ['Birria Taco Trio', 'Churro Bites', 'Queso Fundido'],
  },
  {
    id: 'WingProtocol',
    name: 'WingProtocol',
    items: ['12pc Ghost Pepper Wings', 'Garlic Parmesan Fries', 'Ranch Dip'],
  },
  {
    id: 'GreenBowl',
    name: 'GreenBowl',
    items: ['Ahi Tuna Poke Bowl', 'Matcha Smoothie', 'Avocado Super Bowl'],
  },
];

export default function OrderSimulationPanel() {
  const [selectedBrand, setSelectedBrand] = useState('BurgerForge');
  const [selectedItem, setSelectedItem] = useState('Double Smash Burger');
  const [quantity, setQuantity] = useState(1);
  const [injectionLog, setInjectionLog] = useState<string[]>([]);

  const activeBrandObj = BRANDS.find((b) => b.id === selectedBrand) || BRANDS;

  const handleBrandChange = (brandId: string) => {
    setSelectedBrand(brandId);
    const b = BRANDS.find((brand) => brand.id === brandId);
    if (b) setSelectedItem(b.items);
  };

  const handleInjectOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const orderId = `SIM-${Math.floor(1000 + Math.random() * 9000)}`;
    const logEntry = `[${new Date().toLocaleTimeString()}] Injected ${orderId}: ${quantity}x ${selectedItem} (${selectedBrand})`;

    setInjectionLog((prev) => [logEntry, ...prev]);
  };

  return (
    <div className="font-mono text-xs">
      <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Strict-Typed Order Injection Diagnostics
          </h3>
        </div>
        <span className="text-gray-500">Facility ID: KITCHEN-01</span>
      </div>

      <form onSubmit={handleInjectOrder} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-gray-400 mb-1.5 font-semibold">1. Select DBA Brand</label>
          <select
            value={selectedBrand}
            onChange={(e) => handleBrandChange(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-white outline-none focus:border-sky-500"
          >
            {BRANDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-gray-400 mb-1.5 font-semibold">2. Select Item</label>
          <select
            value={selectedItem}
            onChange={(e) => setSelectedItem(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-white outline-none focus:border-sky-500"
          >
            {activeBrandObj.items.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-gray-400 mb-1.5 font-semibold">3. Quantity</label>
          <input
            type="number"
            min={1}
            max={10}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-white outline-none focus:border-sky-500"
          />
        </div>

        <button
          type="submit"
          className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold p-2.5 rounded-lg uppercase tracking-wider text-xs transition-all"
        >
          ⚡ Inject Mock Order
        </button>
      </form>

      {injectionLog.length > 0 && (
        <div className="mt-4 p-3 bg-gray-950 border border-gray-800 rounded-lg max-h-32 overflow-y-auto">
          <div className="text-gray-500 text-[10px] uppercase font-bold mb-1">Diagnostic Log Queue:</div>
          {injectionLog.map((log, idx) => (
            <div key={idx} className="text-emerald-400 text-[11px] font-mono py-0.5">
              {log}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```
