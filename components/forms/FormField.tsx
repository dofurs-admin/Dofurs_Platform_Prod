import type { ReactNode } from 'react';

export default function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-[#6b6b6b]">
      <span className="font-semibold text-ink">{label}</span>
      {children}
    </label>
  );
}
