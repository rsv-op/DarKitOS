"use client"
import { useState } from 'react'

export default function CookDashboard() {
  // Mock active order state
  const [activeOrder, setActiveOrder] = useState({
    id: 'ORD-001',
    brand: 'Night Owl',
    item: 'Cold Brew Float',
    spec: 'Use exactly 150ml Cold Brew Concentrate',
    status: 'prepping'
  })

  const completePrep = () => {
    setActiveOrder({ ...activeOrder, status: 'completed' })
    // Future: trigger database update & algorithmic depletion here
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <h1 className="text-2xl font-bold mb-6 text-blue-500">Cook Station</h1>
      
      {activeOrder.status === 'prepping' ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-400 font-mono">{activeOrder.id}</span>
            <span className="bg-blue-900/50 text-blue-400 px-3 py-1 rounded-full text-sm">
              {activeOrder.brand}
            </span>
          </div>
          <h2 className="text-3xl font-bold mb-6">{activeOrder.item}</h2>
          
          {/* Hard-Stop Recipe Acknowledgment */}
          <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-md mb-8 text-center">
            <p className="text-red-400 font-mono text-lg">{activeOrder.spec}</p>
          </div>

          <button 
            onClick={completePrep}
            className="w-full bg-green-600 hover:bg-green-700 py-6 rounded-lg text-2xl font-bold"
          >
            Confirm Specs & Complete
          </button>
        </div>
      ) : (
        <div className="text-gray-500 text-xl flex items-center justify-center h-64 border border-dashed border-gray-800 rounded-lg">
          No pending orders
        </div>
      )}
    </div>
  )
}
