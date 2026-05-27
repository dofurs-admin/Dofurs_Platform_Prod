import Image from 'next/image';

export default function RootLoading() {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[linear-gradient(180deg,#fff8f0_0%,#fffdf9_42%,#fff7ee_100%)]"
      aria-label="Loading"
      role="status"
    >
      <Image
        src="/logo/brand-logo.png"
        alt="Dofurs logo"
        width={192}
        height={64}
        quality={60}
        className="h-14 w-44 object-contain sm:h-16 sm:w-48"
      />

      <div className="mt-5 h-1 w-44 overflow-hidden rounded-full bg-[#f1e6da]">
        <div className="h-full w-2/3 animate-pulse rounded-full bg-[#cf8347]" />
      </div>
    </div>
  );
}
