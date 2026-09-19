import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dark-Cloud Kitchen OS',
  description: 'Unified command center for multi-brand cloud kitchens.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
