import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQs — Dofurs',
  description: 'Frequently asked questions about Dofurs pet services, bookings, payments, and more.',
};

export default function FAQsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
