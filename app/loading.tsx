export default function RootLoading() {
  return (
    <div className="loading-screen-root" aria-label="Loading" role="status">
      {/* Decorative background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 14% 10%, rgba(228, 153, 90, 0.12), transparent 52%),
            radial-gradient(circle at 86% 90%, rgba(154, 122, 87, 0.08), transparent 48%)
          `,
        }}
        aria-hidden="true"
      />

      {/* Logo */}
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/brand-logo.png"
          alt="Dofurs logo"
          className="loading-logo-breathe h-14 w-44 object-contain sm:h-16 sm:w-48"
        />
      </div>

      {/* Progress bar */}
      <div className="loading-progress-track mt-6">
        <div className="loading-progress-fill" />
      </div>
    </div>
  );
}
