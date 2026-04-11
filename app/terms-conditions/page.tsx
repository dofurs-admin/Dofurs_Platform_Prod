import type { Metadata } from 'next';
import ContentPageLayout from '@/components/ContentPageLayout';

export const metadata: Metadata = {
  title: 'Terms & Conditions — Dofurs',
  description: 'Read the Dofurs terms and conditions governing use of our platform and services.',
};

export default function TermsConditionsPage() {
  return (
    <ContentPageLayout
      title="Terms & Conditions"
      description="Legally binding terms governing access to and use of the Dofurs platform and services."
      heroImageSrc="/Birthday/terms%20%26%20conditions%20_new.png"
      heroImageAlt="Terms and conditions"
    >
      <div className="mx-auto w-full max-w-3xl">
      <p>Effective Date: 26 February 2025</p>
      <p>Last Updated: 26 February 2025</p>

      <h2 className="mt-4 text-2xl font-semibold text-ink">1. Acceptance of Terms</h2>
      <p>
        By using Dofurs, creating an account, or booking services, you agree to these Terms and our Privacy Policy. If you
        do not agree, you must discontinue use of the platform.
      </p>

      <h2 className="mt-4 text-2xl font-semibold text-ink">2. Eligibility and Accounts</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Users must be legally capable of entering binding contracts under Indian law.</li>
        <li>All registration and booking information must be accurate and current.</li>
        <li>Dofurs may approve, reject, suspend, or terminate accounts at its discretion.</li>
        <li>Users are responsible for account credential security and account activity.</li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">3. Services and Platform Role</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Dofurs facilitates grooming, veterinary, online consultation, and home-visit bookings.</li>
        <li>Dofurs acts as an intermediary connecting users with independent service providers.</li>
        <li>Dofurs does not directly employ all listed professionals and is not liable for independent provider conduct.</li>
        <li>For emergencies, users should seek immediate in-person veterinary care.</li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">4. Bookings, Rescheduling, Cancellation</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Bookings are confirmed only after confirmation notification from Dofurs.</li>
        <li>Rescheduling should be requested at least 2 hours before service and is subject to availability.</li>
        <li>Up to 2 reschedules per booking are allowed; later requests may be treated as cancellation.</li>
        <li>Cancellation and adjustment outcomes follow the published cancellation and adjustment policy.</li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">5. Payments and Charges</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Supported methods include Razorpay online payments, eligible COD, and UPI options at checkout.</li>
        <li>Platform fee (up to 5%), convenience charges, and home-visit surcharges may apply.</li>
        <li>All charges are displayed at checkout; payment implies acceptance of shown charges.</li>
        <li>Prices are in INR and may be updated; applied price is the one shown at payment confirmation.</li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">6. User Conduct and Responsibilities</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Users must provide accurate pet health, behavioural, and booking information.</li>
        <li>Fraud, abuse, impersonation, harassment, scraping, malware, or platform circumvention is prohibited.</li>
        <li>Pet Parents are responsible for pet behaviour and resulting damages/injuries during services.</li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">7. Legal and Liability Terms</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Platform and services are provided on an “as is” and “as available” basis.</li>
        <li>Liability is limited to the maximum extent permitted by law.</li>
        <li>Users agree to indemnify Dofurs for claims arising from misuse or violations.</li>
        <li>Force majeure events may impact performance without liability.</li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">8. Disputes, Governing Law, and Contact</h2>
      <p>
        Disputes should first be raised at petcare@dofurs.in for internal resolution. Unresolved disputes fall under the
        exclusive jurisdiction of courts in Bengaluru, Karnataka, India. These Terms are governed by applicable laws of
        India.
      </p>
      <p>Email: petcare@dofurs.in</p>
      <p>Company: Dofurs</p>
      <p>Address: Dofurs, Bangalore, Karnataka 560100</p>
      </div>
    </ContentPageLayout>
  );
}
