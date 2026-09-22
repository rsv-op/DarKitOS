"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
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
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white p-4 font-sans">
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl max-w-sm w-full text-center">
        <h1 className="text-3xl font-bold font-mono mb-2 text-sky-400">Dark-Cloud OS</h1>
        <p className="text-xs text-gray-400 mb-6 font-mono">Universal Kitchen Station Gateway</p>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="password"
            inputMode="numeric"
            pattern="*"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter Station PIN"
            className="p-4 text-center text-3xl font-mono text-white bg-gray-950 border border-sky-500/30 rounded-xl outline-none focus:border-sky-400 tracking-widest"
            autoFocus
          />

          {error && <p className="text-red-400 text-xs font-mono">{error}</p>}

          <button
            type="submit"
            className="bg-sky-500 hover:bg-sky-400 text-gray-950 font-mono font-bold p-4 rounded-xl text-sm uppercase tracking-wider transition-all"
          >
            Access Station →
          </button>
        </form>

        <div className="mt-6 text-[10px] text-gray-500 font-mono flex justify-center gap-3">
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
