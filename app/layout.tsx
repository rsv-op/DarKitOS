// File: app/layout.tsx
import React from 'react';
import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';

/**
 * Dark/Cloud Kitchen OS - Unified Multi-Brand Ledger
 * Architecture: Next.js App Router | Zero-Dependency Styling
 * Role: Provides the global CSS matrix, typography, and secure navigation routing for the kitchen OS.
 */

// Initialize highly optimized, zero-layout-shift fonts
const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({ 
  subsets: ['latin'], 
  variable: '--font-space-grotesk',
  display: 'swap',
});

// Authoritative B2B Metadata Configuration
export const metadata: Metadata = {
  title: 'Dark/Cloud Kitchen OS | Unified Multi-Brand Ledger',
  description: 'Centralized operational operating system for multi-brand cloud kitchens. Track orders, inventory depletion, and wastage in a single zero-latency dashboard.',
};

// Centralized Navigation Architecture tailored for Kitchen Operations
const NAVIGATION_ROUTES = [
  { name: 'Command Center', href: '/' },
  { name: 'Unified Dispatch', href: '/orders' },
  { name: 'Depletion Matrix', href: '/inventory' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <head>
        {/* Zero-Dependency Global Design System Injection */}
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            /* Institutional Dark Void Palette */
            --bg-void: #0b132b;
            --bg-surface: #1e293b;
            --bg-surface-hover: #334155;
            --accent-sky: #38bdf8;
            --accent-emerald: #10b981;
            --accent-warning: #f59e0b;
            --accent-critical: #ef4444;
            
            /* Typography Variables */
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
            
            /* Layout Geometry */
            --border-radius-sm: 4px;
            --border-radius-md: 8px;
            --border-radius-lg: 12px;
            --border-glass: 1px solid rgba(255, 255, 255, 0.08);
          }
          
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          body {
            background-color: var(--bg-void);
            color: var(--text-primary);
            font-family: var(--font-inter), system-ui, sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            overflow-x: hidden;
          }

          /* Display Typography Override */
          h1, h2, h3, h4, h5, h6, .display-font {
            font-family: var(--font-space-grotesk), system-ui, sans-serif;
            letter-spacing: -0.02em;
          }

          /* Global Navigation Architecture */
          .os-header {
            background-color: rgba(11, 19, 43, 0.95);
            border-bottom: var(--border-glass);
            position: sticky;
            top: 0;
            z-index: 2000;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
          }

          .os-nav-container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .os-brand {
            font-family: var(--font-space-grotesk), sans-serif;
            font-weight: 700;
            font-size: 1.5rem;
            color: var(--text-primary);
            text-decoration: none;
            display: flex;
            align-items: center;
            letter-spacing: -0.04em;
          }

          .os-brand span {
            color: var(--accent-emerald);
          }

          .os-nav-links {
            display: flex;
            gap: 2rem;
            align-items: center;
          }

          .os-nav-links a {
            color: var(--text-secondary);
            text-decoration: none;
            font-size: 0.875rem;
            font-weight: 600;
            transition: color 0.2s ease, background-color 0.2s ease;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 0.5rem 1rem;
            border-radius: var(--border-radius-md);
          }

          .os-nav-links a:hover {
            color: var(--text-primary);
            background-color: rgba(255, 255, 255, 0.05);
          }

          .os-status-badge {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.75rem;
            font-weight: 700;
            color: var(--accent-emerald);
            background: rgba(16, 185, 129, 0.1);
            padding: 0.4rem 0.75rem;
            border-radius: 50px;
            border: 1px solid rgba(16, 185, 129, 0.2);
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .status-dot {
            width: 8px;
            height: 8px;
            background-color: var(--accent-emerald);
            border-radius: 50%;
            box-shadow: 0 0 8px var(--accent-emerald);
            animation: pulse 2s infinite;
          }

          @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
          }

          /* Mobile Viewport Collision Patch */
          @media (max-width: 768px) {
            .os-nav-container {
              flex-direction: column;
              padding: 1rem;
              gap: 1rem;
            }
            .os-brand {
              font-size: 1.5rem;
            }
            .os-nav-links {
              width: 100%;
              justify-content: center;
              flex-wrap: wrap;
              gap: 0.5rem;
            }
            .os-nav-links a {
              font-size: 0.75rem;
            }
          }

          /* Layout Primitives */
          .os-main {
            flex: 1;
            width: 100%;
            display: flex;
            flex-direction: column;
          }
        `}} />
      </head>
      <body>
        <header className="os-header">
          <nav className="os-nav-container">
            <a href="/" className="os-brand">Dark/Cloud<span>OS</span></a>
            <div className="os-nav-links">
              {NAVIGATION_ROUTES.map((route) => (
                <a key={route.href} href={route.href}>
                  {route.name}
                </a>
              ))}
            </div>
            <div className="os-status-badge">
              <div className="status-dot"></div>
              Local Sync Active
            </div>
          </nav>
        </header>
        
        <main className="os-main">
          {children}
        </main>
      </body>
    </html>
  );
}
