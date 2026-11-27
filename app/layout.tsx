import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "DarKitOS — Cloud Kitchen Operating System",
  description:
    "Native operational workspace for Indian multi-brand cloud kitchens: live KDS, dispatch, per-kitchen inventory, GST invoicing, and Gemini copilot.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#09090b] text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
