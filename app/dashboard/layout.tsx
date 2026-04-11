import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Plus_Jakarta_Sans } from 'next/font/google';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main
        className={`${plusJakarta.className} dofurs-mobile-main relative overflow-hidden bg-[linear-gradient(180deg,#fffcf8_0%,#fffaf6_40%,#fffcf9_100%)] pt-16 text-ink sm:pt-20`}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[440px] bg-[radial-gradient(circle_at_12%_2%,rgba(228,153,90,0.16),transparent_52%),radial-gradient(circle_at_90%_10%,rgba(154,122,87,0.1),transparent_48%),linear-gradient(to_bottom,rgba(255,248,240,0.72),rgba(255,255,255,0))]"
          aria-hidden="true"
        />
        <div className="relative mx-auto w-full max-w-6xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
          <section className="rounded-2xl border border-[#ecd6c2] bg-[linear-gradient(180deg,#ffffff_0%,#fff9f3_40%,#fbf4ec_100%)] p-3 shadow-[0_14px_30px_rgba(132,95,61,0.1)] sm:rounded-[1.75rem] sm:p-5 sm:shadow-[0_20px_42px_rgba(132,95,61,0.12)] md:p-6">
            {children}
          </section>
        </div>
      </main>
      <div className="hidden md:block">
        <Footer />
      </div>
    </>
  );
}
