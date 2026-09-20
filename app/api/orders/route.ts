
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) =&gt; {
    e.preventDefault();

    if (pin === '1111') {
      document.cookie = 'kitchen_pin=cook_token; path=/';
      router.push('/cook');
    } else if (pin === '2222') {
      document.cookie = 'kitchen_pin=dispatch_token; path=/';
      router.push('/dispatch');
    } else if (pin === '3333') {
      document.cookie = 'kitchen_pin=owner_token; path=/';
      router.push('/owner');
    } else if (pin === '9999') {
      // Dev bypass token - defaults to Owner view but can navigate anywhere
      document.cookie = 'kitchen_pin=dev_token; path=/';
      router.push('/owner');
    } else {
      setError('Invalid Station PIN');
    }
  };

  return (
    <div>
      <div>
        <h1>Dark-Cloud OS</h1>
        <p>Universal Kitchen Station Gateway</p>

        

        <div>
          <span>Cook: 1111</span>
          <span>•</span>
          <span>Dispatch: 2222</span>
          <span>•</span>
          <span>Owner: 3333</span>
        </div>
      </div>
    </div>
  );
}

```

---

Ready for **File 7 of 11** (`/app/cook/page.tsx`)? Reply **Next** when you're ready to proceed.

Yes

code directory &gt; /app/cook/page.tsx

```
// File: app/cook/page.tsx
"use client";

import React, { useState } from 'react';
import { Order, OrderStatus } from '@/lib/db';

const MOCK_COOK_ORDERS: Order[] = [
  {
    id: 'ORD-8801',
    brandId: 'BurgerForge',
    channel: 'DoorDash',
    status: 'PREPARING',
    items: [
      { id: 'item-1', menuItemId: 'MENU-BF-01', name: 'Double Smash Burger', quantity: 2, station: 'Grill', notes: 'Extra Pickles, No Onions' },
      { id: 'item-2', menuItemId: 'MENU-BF-02', name: 'Truffle Fries', quantity: 1, station: 'Fryer' },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ORD-8803',
    brandId: 'WingProtocol',
    channel: 'GrubHub',
    status: 'PENDING',
    items: [
      { id: 'item-4', menuItemId: 'MENU-WP-01', name: '12pc Ghost Pepper Wings', quantity: 1, station: 'Fryer', notes: 'Extra Ranch' },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function CookStationPage() {
  const [activeStationFilter, setActiveStationFilter] = useState
