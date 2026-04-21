import type { Metadata } from 'next';
import { faqsList } from '@/lib/faqs-data';

export const metadata: Metadata = {
  title: 'Pet Services FAQs — Bookings, Providers, Payments | Dofurs Bangalore',
  description:
    'Answers to the most common questions about Dofurs pet services in Bangalore — bookings, provider verification, cancellations, payments, coverage areas, and pet profile management.',
  alternates: { canonical: '/faqs' },
  openGraph: {
    title: 'Pet Services FAQs | Dofurs Bangalore',
    description:
      'Everything pet parents in Bangalore need to know about bookings, providers, payments, and support on Dofurs.',
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
