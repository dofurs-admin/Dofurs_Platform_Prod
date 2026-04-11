export default function DashboardLoading() {
  return (
    <div className="space-y-4 p-4 sm:p-8">
      {/* Hero skeleton */}
      <div className="animate-pulse space-y-3 rounded-2xl border border-brand-100/60 bg-white/60 p-5 sm:rounded-3xl sm:p-8">
        <div className="h-3 w-40 rounded-full bg-neutral-200/60" />
        <div className="h-7 w-64 rounded-full bg-neutral-200/70" />
        <div className="h-4 w-48 rounded-full bg-neutral-200/50" />
        <div className="flex gap-2 pt-2">
          <div className="h-10 w-32 rounded-full bg-neutral-200/60" />
          <div className="h-10 w-28 rounded-full bg-neutral-200/50" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse space-y-2 rounded-xl border border-neutral-200/40 bg-white/50 p-4">
            <div className="h-3 w-16 rounded-full bg-neutral-200/60" />
            <div className="h-6 w-10 rounded-full bg-neutral-200/70" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="animate-pulse space-y-3 rounded-2xl border border-neutral-200/40 bg-white/50 p-5">
            <div className="h-5 w-32 rounded-full bg-neutral-200/60" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-neutral-200/50" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-3/4 rounded-full bg-neutral-200/60" />
                  <div className="h-3 w-1/2 rounded-full bg-neutral-200/40" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
