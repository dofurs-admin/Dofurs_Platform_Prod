import type { Metadata } from 'next';
import ContentPageLayout from '@/components/ContentPageLayout';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description:
    'Terms and conditions governing your use of the Dofurs pet grooming platform — bookings, payments, cancellations, provider relationships, and user responsibilities.',
  alternates: { canonical: 'https://dofurs.in/terms-conditions' },
  openGraph: {
    title: 'Terms & Conditions | Dofurs',
    description: 'Legally binding terms governing access to and use of the Dofurs platform.',
    url: 'https://dofurs.in/terms-conditions',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function TermsConditionsPage() {
  return (
    <ContentPageLayout
      title="Terms & Conditions"
      description="Legally binding terms governing access to and use of the Dofurs grooming platform and services."
      heroImageSrc="/Birthday/terms%20%26%20conditions%20_new.webp"
      heroImageAlt="Terms and conditions"
    >
      <div className="mx-auto w-full max-w-3xl">
      <p>Effective Date: 26 February 2025</p>
      <p>Last Updated: 11 June 2026</p>

      <h2 className="mt-4 text-2xl font-semibold text-ink">1. Acceptance of Terms</h2>
      <p>
        By using Dofurs, creating an account, or booking services, you agree to these Terms and our Privacy Policy. If you
        do not agree, you must discontinue use of the platform. Each booking placed on Dofurs is treated as an explicit
        acceptance of these Terms.
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
        <li>Dofurs currently facilitates doorstep grooming bookings.</li>
        <li>Dofurs acts as an intermediary connecting users with independent service providers.</li>
        <li>Dofurs does not directly employ all listed professionals and is not liable for independent provider conduct.</li>
        <li>For emergencies, users should seek immediate in-person veterinary care.</li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">4. Bookings, Rescheduling, Cancellation</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Bookings are confirmed only after confirmation notification from Dofurs.</li>
        <li>Rescheduling should be requested at least 2 hours before service and is subject to availability.</li>
        <li>Up to 2 reschedules per booking are allowed; later requests may be treated as cancellation.</li>
        <li>Dofurs or assigned providers may refuse, pause, or terminate service if pet behaviour or premises are unsafe.</li>
        <li>
          If a provider has been dispatched and service cannot proceed due user-side causes (for example, undisclosed
          aggression, denied access, no responsible handler present, or unsafe premises), an aborted-visit or
          slot-blocking fee may apply.
        </li>
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
        <li>Users must disclose any prior aggression, bite incidents, handling triggers, and sedation/medical constraints.</li>
        <li>
          A responsible adult must be present during service and must provide safe handling support, including leash,
          muzzle, or restraint assistance when reasonably requested.
        </li>
        <li>Users must provide safe access and a hygienic service area with adequate ventilation, lighting, and water.</li>
        <li>Fraud, abuse, impersonation, harassment, scraping, malware, or platform circumvention is prohibited.</li>
        <li>Pet Parents are responsible for pet behaviour and resulting damages or injuries during services.</li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">7. Pet Safety and Aggressive Behaviour Policy</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Dofurs does not service pets that are known to be aggressive or that display unsafe behaviour at the appointment.</li>
        <li>If aggression is undisclosed, misrepresented, or discovered at service time, Dofurs may cancel or abort the service.</li>
        <li>In such cases, applicable visit, slot-blocking, or cancellation charges may still be applied.</li>
        <li>
          The booking customer is liable for direct losses arising from aggressive pet behaviour, including bites, injuries,
          and equipment or property damage caused during or in connection with the appointment.
        </li>
        <li>
          To the extent permitted by law, users agree to indemnify and hold Dofurs and assigned providers harmless from
          related third-party claims, costs, and reasonable legal expenses.
        </li>
        <li>
          Dofurs and assigned providers are not liable for outcomes directly caused by undisclosed or pre-existing
          medical and behavioural conditions.
        </li>
        <li>
          Dofurs may create incident records, including photographs, video, and written notes, for safety, claims,
          fraud prevention, and legal compliance.
        </li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">8. Enterprise Service Protection Terms</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          Repeated safety incidents, undisclosed aggression, or false declarations may lead to booking refusal,
          account suspension, or permanent platform ban.
        </li>
        <li>
          Dofurs may recover direct third-party costs, medical costs, equipment repair costs, and legal expenses
          attributable to user breaches, to the extent permitted by law.
        </li>
        <li>
          Dofurs reserves the right to deny future bookings until outstanding damage claims or safety investigations
          are resolved.
        </li>
        <li>
          Where required, customers agree to cooperate with post-incident verification, including sharing factual
          statements and relevant details.
        </li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">9. Legal and Liability Terms</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Platform and services are provided on an “as is” and “as available” basis.</li>
        <li>Liability is limited to the maximum extent permitted by law.</li>
        <li>Users agree to indemnify Dofurs for claims arising from misuse or violations.</li>
        <li>Force majeure events may impact performance without liability.</li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">10. Disputes, Governing Law, and Contact</h2>
      <p>
        Disputes should first be raised at petcare@dofurs.in for internal resolution. Unresolved disputes fall under the
        exclusive jurisdiction of courts in Bengaluru, Karnataka, India. These Terms are governed by applicable laws of
        India.
      </p>
      <p>Email: petcare@dofurs.in</p>
      <p>Company: Dofurs</p>
      <p>Address: Dofurs, Bengaluru, Karnataka 560100</p>
      </div>
    </ContentPageLayout>
  );
}
