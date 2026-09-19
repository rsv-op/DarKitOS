import OrderSimulationPanel from '../../components/OrderSimulationPanel'

export default function OwnerDashboard() {
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <h1 className="text-2xl font-bold mb-6 text-purple-500">Command Center (Owner)</h1>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 text-center">
          <p className="text-gray-400 text-sm">Active Orders</p>
          <p className="text-3xl font-bold">12</p>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 text-center">
          <p className="text-gray-400 text-sm">Avg Prep Time</p>
          <p className="text-3xl font-bold">4m 12s</p>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 text-center text-red-400">
          <p className="text-red-500 text-sm">Critical Stock</p>
          <p className="text-3xl font-bold">3 items</p>
        </div>
      </div>

      {/* This is the imported component taking the place of the old buttons */}
      <OrderSimulationPanel />

    </div>
  )
}
