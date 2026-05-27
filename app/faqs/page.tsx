"use client";

import { useState } from 'react';
import ContentPageLayout from '@/components/ContentPageLayout';
import { ChevronDown } from 'lucide-react';
import { faqsList } from '@/lib/faqs-data';

export default function FaqsPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <ContentPageLayout
      title="Pet Grooming FAQs — Dofurs Bengaluru"
      description="Everything you need to know about doorstep grooming bookings, packages, groomer verification, payments, coverage areas, and support on Dofurs in Bengaluru."
      heroImageSrc="/Birthday/faqs_new.webp"
      heroImageAlt="Dofurs pet grooming FAQs for Bengaluru pet parents"
      heroImageFirstOnMobile
    >
      <div className="grid gap-4">
        {faqsList.map((item, index) => {
          const isOpen = openIndex === index;

          return (
            <div key={item.question} className="overflow-hidden rounded-2xl border border-[#f1e6da] bg-white shadow-soft">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                onClick={() => setOpenIndex((current) => (current === index ? null : index))}
                aria-expanded={isOpen}
              >
                <span className="text-lg font-semibold text-ink">{item.question}</span>
                <ChevronDown className={`h-5 w-5 text-[#6b6b6b] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              <div className={`grid transition-all duration-300 ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <p className="px-5 pb-4 text-[#6b6b6b]">{item.answer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ContentPageLayout>
  );
}
