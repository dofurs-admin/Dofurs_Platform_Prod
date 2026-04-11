'use client';

import type { ReactNode } from 'react';

export function IconTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-[calc(100%+0.35rem)] z-[70] -translate-x-1/2 rounded-md border border-[#dfba97] bg-[linear-gradient(155deg,rgba(255,252,247,0.97),rgba(255,243,230,0.95))] px-2 py-1 text-[11px] font-semibold text-[#6a4a33] opacity-0 shadow-[0_8px_16px_rgba(116,76,44,0.18)] transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100"
      >
        {label}
      </span>
    </div>
  );
}
