export default function DispatchDashboard() {
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <h1 className="text-2xl font-bold mb-6 text-green-500">Dispatch TV Pipeline</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-gray-800 bg-gray-900/50 rounded-lg p-4">
          <h2 className="text-gray-400 font-mono mb-4 border-b border-gray-800 pb-2">PREPPING</h2>
          {/* Prepping list goes here */}
        </div>
        
        <div className="border border-green-900/30 bg-gray-900/50 rounded-lg p-4">
          <h2 className="text-green-500 font-mono mb-4 border-b border-gray-800 pb-2">READY FOR HANDOFF</h2>
          {/* Completed orders populate here automatically */}
          <div className="bg-gray-800 p-4 rounded-md flex justify-between items-center">
            <div>
              <p className="font-bold">ORD-001</p>
              <p className="text-sm text-gray-400">Night Owl - Cold Brew Float</p>
            </div>
            <button className="bg-green-600 px-4 py-2 rounded-md font-bold text-sm">
              Hand to Driver
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
