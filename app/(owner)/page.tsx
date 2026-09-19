
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

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">System Actions</h2>
        <div className="flex gap-4 flex-wrap">
          <button className="bg-purple-600/20 text-purple-400 border border-purple-900/50 px-4 py-2 rounded-md text-sm">
            Generate Daily PINs
          </button>
          <button className="bg-blue-600/20 text-blue-400 border border-blue-900/50 px-4 py-2 rounded-md text-sm">
            Strict-Typed Mock Injector
          </button>
        </div>
      </div>
    </div>
  )
}
