"use client";

import React, { useEffect } from "react";

export interface SplitInspectorProps {
  open: boolean;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  mode?: "docked" | "overlay";
  widthClassName?: string;
  children: React.ReactNode;
}

export function SplitInspector({
  open,
  title,
  subtitle,
  badge,
  onClose,
  footer,
  mode = "docked",
  widthClassName,
  children,
}: SplitInspectorProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const panelContent = (
    <div className="flex h-full flex-col bg-[#0e0e11] text-zinc-100">
      <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold tracking-tight text-zinc-100 tabular-nums">
              {title}
            </h2>
            {badge}
          </div>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-zinc-400 tabular-nums">
              {subtitle}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-white/[0.08] bg-[#151519] px-2 text-[11px] font-medium text-zinc-400 transition-colors hover:border-white/[0.16] hover:text-zinc-100"
        >
          <span>ESC</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>

      {footer && (
        <footer className="border-t border-white/[0.06] bg-[#09090b]/80 px-4 py-3">
          {footer}
        </footer>
      )}
    </div>
  );

  if (mode === "docked") {
    return (
      <>
        {/* Desktop Docked Right Split-Pane */}
        <aside
          aria-label={title}
          className={`hidden lg:flex lg:shrink-0 lg:flex-col lg:border-l lg:border-white/[0.06] lg:bg-[#0e0e11] ${
            widthClassName ?? "lg:w-[420px]"
          }`}
        >
          {panelContent}
        </aside>

        {/* Mobile / Tablet Slide-Over Sheet */}
        <div className="fixed inset-0 z-50 flex justify-end lg:hidden">
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/65 backdrop-blur-[2px] transition-opacity"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-white/[0.08] bg-[#0e0e11] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          >
            {panelContent}
          </aside>
        </div>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/65 backdrop-blur-[2px] transition-opacity"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 flex h-full w-full flex-col border-l border-white/[0.08] bg-[#0e0e11] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          widthClassName ?? "max-w-[520px]"
        }`}
      >
        {panelContent}
      </aside>
    </div>
  );
}

export default SplitInspector;
