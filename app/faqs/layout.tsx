import type { Metadata } from 'next';
import { faqsList } from '@/lib/faqs-data';

export const metadata: Metadata = {
  title: 'Pet Grooming FAQs — Bookings, Packages, Payments',
  description:
    'Answers to the most common questions about Dofurs doorstep grooming in Bengaluru — bookings, groomer verification, packages, cancellations, payments, coverage areas, and pet profile management.',
  alternates: { canonical: '/faqs' },
  openGraph: {
    title: 'Pet Grooming FAQs | Dofurs Bengaluru',
    description:
      'Everything pet parents in Bengaluru need to know about grooming bookings, packages, payments, and support on Dofurs.',
    url: 'https://dofurs.in/faqs',
    images: ['/logo/og-default.jpg'],
  },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqsList.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
};

export default function FAQsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {children}
    </>
  );
}
