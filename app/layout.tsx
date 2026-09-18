
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Dark-Cloud Kitchen OS",
  description: "Unified multi-brand operational ledger for cloud kitchens.",
};

const shellStyle: Record<string, string> = {
  minHeight: "100vh",
  background: "#070b14",
  color: "#e2e8f0",
  margin: "0",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={shellStyle}>
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
