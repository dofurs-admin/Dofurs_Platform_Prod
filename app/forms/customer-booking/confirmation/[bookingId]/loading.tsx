import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';

export default function BookingConfirmationLoading() {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#fffcf8] px-4 pb-16 pt-28 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-[1200px] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-[28px] border border-[#ecd6c2] bg-white p-6 shadow-premium">
            <LoadingSkeleton lines={8} />
          </section>
          <aside className="rounded-[28px] border border-[#ecd6c2] bg-white p-6 shadow-premium">
            <LoadingSkeleton lines={5} />
          </aside>
        </div>
      </div>
      <Footer />
    </>
  );
}