import { useEffect, useRef } from 'react';

type ConfirmationProps = {
  providerName?: string;
  bookingDate: string;
  slotStartTime: string;
  bookingMode: string;
  petName?: string;
  totalAmount: number;
  amountStatus?: 'payable' | 'paid';
};

export default function PremiumBookingConfirmation({
  providerName,
  bookingDate,
  slotStartTime,
  bookingMode,
  petName,
  totalAmount,
  amountStatus = 'payable',
}: ConfirmationProps) {
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const scrollToConfirmationTop = () => {
      const section = sectionRef.current;
      if (!section) {
        return;
      }

      const headerOffset = 96;
      const top = section.getBoundingClientRect().top + window.scrollY - headerOffset;

      window.scrollTo({
        top: Math.max(top, 0),
        behavior: 'auto',
      });
    };

    const rafId = window.requestAnimationFrame(scrollToConfirmationTop);
    const timeoutId = window.setTimeout(scrollToConfirmationTop, 120);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <section ref={sectionRef} className="mx-auto w-full max-w-3xl px-1 py-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-coral">Pet service booking successful</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Your pet just got promoted to VIP.</h2>
      <p className="mt-3 text-sm text-[#6b6b6b] sm:text-base">
        Booked and locked: your pet care crew will be at your doorstep soon, so sit back, relax, and let the tail-wagging begin.
      </p>

      <div className="mt-8 grid gap-3 text-left text-sm text-[#5f5f5f] sm:grid-cols-2">
        <p><span className="font-semibold text-ink">Provider:</span> {providerName ?? 'Assigned provider'}</p>
        <p><span className="font-semibold text-ink">Pet:</span> {petName ?? 'Selected pet'}</p>
        <p><span className="font-semibold text-ink">Date:</span> {bookingDate}</p>
        <p><span className="font-semibold text-ink">Time:</span> {slotStartTime}</p>
        <p><span className="font-semibold text-ink">Mode:</span> {bookingMode.replace('_', ' ')}</p>
        <p><span className="font-semibold text-ink">{amountStatus === 'paid' ? 'Paid:' : 'Payable:'}</span> ₹{totalAmount}</p>
      </div>

      <a
        href="/dashboard"
        className="mt-8 inline-flex items-center justify-center rounded-full bg-[linear-gradient(115deg,#de9158,#c7773b)] px-8 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(199,119,59,0.24)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(199,119,59,0.3)]"
      >
        Return to dashboard
      </a>
    </section>
  );
}
