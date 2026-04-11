"use client";

import { useState } from 'react';
import ContentPageLayout from '@/components/ContentPageLayout';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: 'How do I book a service?',
    answer: 'Go to the booking section or Contact Us page, open the booking form, submit details, and our team will confirm availability.',
  },
  {
    question: 'How are providers verified?',
    answer: 'We review profile details, service information, and onboarding checks before providers are listed for bookings.',
  },
  {
    question: 'Can I cancel or reschedule?',
    answer: 'Yes, cancellation and rescheduling are supported under our cancellation and adjustment policy. You can cancel from your dashboard or contact support.',
  },
  {
    question: 'Do you support birthday event bookings?',
    answer: 'Yes, birthday celebration requests are available through our dedicated birthday booking form.',
  },
  {
    question: 'What areas do you serve?',
    answer: 'We currently serve Bangalore. Enter your pincode in the header to check availability.',
  },
  {
    question: 'How do I pay for services?',
    answer: 'Payment can be made directly to the provider at the time of service, through the Dofurs platform, or via split payment depending on the service type.',
  },
  {
    question: 'What if I am not satisfied with a service?',
    answer: 'Your satisfaction is our priority. Contact us within 24 hours of the service and we will work with the provider to resolve any concerns or offer a suitable remedy.',
  },
  {
    question: 'How do I add or edit my pet profiles?',
    answer: 'Go to your Dashboard and click "Pet Profiles" to add new pets or edit existing ones. You can add medical records, vaccination history, and behavioral notes.',
  },
  {
    question: 'Is my personal information secure?',
    answer: 'Yes, we use industry-standard encryption and security practices. Your data is stored securely and never shared with third parties without your consent.',
  },
  {
    question: 'How do I become a service provider on Dofurs?',
    answer: 'Click "Join us as a service provider" in the navigation menu or visit our provider application form. We review applications and onboard qualified professionals.',
  },
];

export default function FaqsPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <ContentPageLayout
      title="Frequently Asked Questions"
      description="Everything you need to know about bookings, providers, and pet care support on Dofurs."
      heroImageSrc="/Birthday/faqs_new.png"
      heroImageAlt="Frequently asked questions"
      heroImageFirstOnMobile
    >
      <div className="grid gap-4">
        {faqs.map((item, index) => {
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
