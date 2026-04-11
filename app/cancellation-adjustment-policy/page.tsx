import type { Metadata } from 'next';
import ContentPageLayout from '@/components/ContentPageLayout';

export const metadata: Metadata = {
  title: 'Cancellation & Adjustment Policy — Dofurs',
  description: 'Understand the Dofurs cancellation and adjustment policy for bookings and services.',
};

export default function CancellationAdjustmentPolicyPage() {
  return (
    <ContentPageLayout
      title="Cancellation & Adjustment Policy"
      description="Policy governing booking cancellation timelines, direct-to-provider payment handling, and support-led adjustments."
      heroImageSrc="/Birthday/refund%20%26%20cancelation%20_new.png"
      heroImageAlt="Cancellation and adjustment policy"
    >
      <h2 className="mt-2 text-2xl font-semibold text-ink">6.1 Cancellation by User</h2>
      <p>Users may cancel a confirmed booking through the platform or by contacting support.</p>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <strong>More than 1 hour before service:</strong> No platform cancellation charge applies.
        </li>
        <li>
          <strong>Less than 1 hour before service:</strong> Provider cancellation terms may apply and are handled
          directly between user and provider.
        </li>
        <li>
          <strong>No-show:</strong> Provider no-show terms may apply.
        </li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">6.2 Cancellation by Dofurs or Service Provider</h2>
      <p>
        If a booking is cancelled by Dofurs or a service provider due to unavailability, unforeseen circumstances, or force
        majeure, users receive either:
      </p>
      <ul className="list-disc space-y-2 pl-6">
        <li>Priority rescheduling at no additional platform fee, or</li>
        <li>Rescheduling at no additional charge (user choice).</li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">6.3 Payment and Adjustment Handling</h2>
      <p>
        Dofurs does not collect online payments for these bookings. Service payments are made directly to providers,
        and any monetary adjustments are coordinated between user and provider. Platform support may intervene for dispute
        resolution where appropriate.
      </p>

      <h2 className="mt-4 text-2xl font-semibold text-ink">6.4 Dispute Over Service Quality</h2>
      <p>
        If dissatisfied with a completed service, users must report to petcare@dofurs.in within 24 hours with details.
        After review, Dofurs may facilitate a fair adjustment outcome, complimentary re-service, or platform credits at its sole
        discretion.
      </p>
    </ContentPageLayout>
  );
}
