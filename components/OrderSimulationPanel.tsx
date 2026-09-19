"use client"
import { useState } from 'react'

const MENU_MAP = {
  'Night Owl': ['Cold Brew Float', 'Midnight Mocha', 'Oat Latte (XL)'],
  'Fry Society': ['Loaded Fries', 'Truffle Fry Bucket', 'Fry Flight (3)'],
  'Verdant': ['Plant Smash Burger', 'Mozzarella Melt', 'Green Stack'],
  'Cluck & Co': ['Chicken Tenders Box', 'Crispy Chicken Stack', 'Sauce-Double Burger']
}

export default function OrderSimulationPanel() {
  const [brand, setBrand] = useState('')
  const [item, setItem] = useState('')
  const [qty, setQty] = useState(1)
  const [status, setStatus] = useState('')

  const handleInject = () => {
    if (!brand || !item || qty < 1) return
    setStatus(`Successfully injected ${qty}x ${item} for ${brand}`)
    
    // Reset after 3 seconds
    setTimeout(() => {
      setStatus('')
      setBrand('')
      setItem('')
      setQty(1)
    }, 3000)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mt-6">
      <h2 className="text-xl font-bold mb-4 text-blue-400">Strict-Typed Mock Injector</h2>
      <p className="text-gray-400 text-sm mb-6">Inject test orders without risking database corruption.</p>

      <div className="flex flex-col gap-4 max-w-md">
        <select 
          className="p-3 bg-gray-950 border border-gray-700 rounded text-white"
          value={brand}
          onChange={(e) => {
            setBrand(e.target.value)
            setItem('') // Reset item when brand changes
          }}
        >
          <option value="">1. Select Brand</option>
          {Object.keys(MENU_MAP).map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <select 
          className="p-3 bg-gray-950 border border-gray-700 rounded text-white"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          disabled={!brand}
        >
          <option value="">2. Select Item</option>
          {brand && MENU_MAP[brand as keyof typeof MENU_MAP].map(i => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>

        <input 
          type="number" 
          min="1"
          className="p-3 bg-gray-950 border border-gray-700 rounded text-white"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          disabled={!item}
        />

        <button 
          onClick={handleInject}
          disabled={!brand || !item}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed p-4 rounded-md font-bold mt-2"
        >
          Inject Order
        </button>

        {status && (
          <div className="mt-4 p-3 bg-green-900/30 border border-green-800 text-green-400 rounded text-center">
            {status}
          </div>
        )}
      </div>
    </div>
  )
}
