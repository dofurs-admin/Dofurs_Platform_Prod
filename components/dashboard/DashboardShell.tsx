import type { ReactNode } from 'react';

export default function DashboardShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-[#e8ccb3] bg-[linear-gradient(140deg,#fff4e4_0%,#fffdf9_52%,#ffe9d2_100%)] p-5 shadow-premium-md">
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-[#6b6b6b]">{subtitle}</p> : null}
      </div>
      <div className="rounded-2xl border border-[#e8ccb3] bg-[linear-gradient(180deg,#ffffff_0%,#fff8f1_100%)] p-5 shadow-premium-md">{children}</div>
    </section>
  );
}
