import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Plus_Jakarta_Sans } from 'next/font/google';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className={`${plusJakarta.className} dofurs-mobile-main relative overflow-hidden pt-16 text-ink`}>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_14%_4%,rgba(228,153,90,0.16),transparent_52%),radial-gradient(circle_at_84%_8%,rgba(154,122,87,0.1),transparent_48%),linear-gradient(to_bottom,rgba(255,248,240,0.74),rgba(255,255,255,0))]"
          aria-hidden="true"
        />
        <div className="relative">{children}</div>
      </main>
      <Footer />
    </>
  );
}
