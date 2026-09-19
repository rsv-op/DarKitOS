"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (pin === '1111') {
      document.cookie = "kitchen_pin=cook_token; path=/"
      router.push('/cook')
    } else if (pin === '2222') {
      document.cookie = "kitchen_pin=dispatch_token; path=/"
      router.push('/dispatch')
    } else if (pin === '3333') {
      document.cookie = "kitchen_pin=owner_token; path=/"
      router.push('/owner')
    } else if (pin === '9999') {
      // Dev bypass token - defaults to Owner view but can navigate anywhere
      document.cookie = "kitchen_pin=dev_token; path=/"
      router.push('/owner')
    } else {
      setError('Invalid Station PIN')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white p-4">
      <h1 className="text-3xl font-bold mb-8">Dark-Cloud OS</h1>
      <form onSubmit={handleLogin} className="flex flex-col gap-4 w-full max-w-xs">
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Enter Station PIN"
          className="p-4 text-center text-3xl text-black rounded-md outline-none"
          autoFocus
        />
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <button 
          type="submit" 
          className="bg-blue-600 hover:bg-blue-700 p-4 rounded-md text-xl font-bold transition-colors"
        >
          Access Station
        </button>
      </form>
    </div>
  )
}
