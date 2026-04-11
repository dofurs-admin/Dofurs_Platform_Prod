import type { Metadata } from 'next';
import Link from 'next/link';
import ContentPageLayout from '@/components/ContentPageLayout';
import { links, whatsappLinks } from '@/lib/site-data';

export const metadata: Metadata = {
  title: 'Contact Us — Dofurs',
  description: 'Get in touch with the Dofurs team for support, partnerships, or feedback. We are here to help with all your pet care needs.',
  openGraph: { title: 'Contact Us — Dofurs', description: 'Get in touch with the Dofurs team.' },
};

export default function ContactUsPage() {
  return (
    <ContentPageLayout
      title="Contact Us"
      description="Have a question, feedback, or partnership request? We are here to help."
      heroImageSrc="/Birthday/contact%20us_new.png"
      heroImageAlt="Contact Dofurs"
    >
      <div className="h-px w-full bg-[#efdecd]" aria-hidden="true" />

      {/* Contact channels */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl border border-[#f2dfcf] bg-[#fffdfb] p-5 shadow-soft-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Email</p>
          <a href="mailto:petcare@dofurs.in" className="mt-1 block text-[15px] font-semibold text-ink hover:text-coral transition-colors">
            petcare@dofurs.in
          </a>
        </div>
        <div className="rounded-3xl border border-[#f2dfcf] bg-[#fffdfb] p-5 shadow-soft-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Support Hours</p>
          <p className="mt-1 text-[15px] font-semibold text-ink">Mon - Sat, 9 AM - 7 PM</p>
        </div>
        <div className="rounded-3xl border border-[#f2dfcf] bg-[#fffdfb] p-5 shadow-soft-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">WhatsApp</p>
          <a
            href={whatsappLinks.support}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-2 text-[15px] font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            Chat with us on WhatsApp
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.496A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.337 0-4.498-.756-6.253-2.036l-.44-.33-2.633.883.883-2.633-.33-.44A9.96 9.96 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" /></svg>
          </a>
        </div>
        <div className="rounded-3xl border border-[#f2dfcf] bg-[#fffdfb] p-5 shadow-soft-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Location</p>
          <p className="mt-1 text-[15px] font-semibold text-ink">Bangalore</p>
        </div>
      </div>

      <div className="mt-1 flex flex-wrap gap-4">
        <Link
          href={links.booking}
          className="inline-flex rounded-full bg-coral px-7 py-3 text-sm font-semibold text-white shadow-soft-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#cf8448] hover:shadow-[0_14px_28px_rgba(227,154,93,0.32)]"
        >
          Customer Booking Form
        </Link>
        <Link
          href={links.provider}
          className="inline-flex rounded-full bg-coral px-7 py-3 text-sm font-semibold text-white shadow-soft-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#cf8448] hover:shadow-[0_14px_28px_rgba(227,154,93,0.32)]"
        >
          Provider Application Form
        </Link>
      </div>
    </ContentPageLayout>
  );
}
