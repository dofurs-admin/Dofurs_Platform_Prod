import type { Metadata } from 'next';
import ContentPageLayout from '@/components/ContentPageLayout';

export const metadata: Metadata = {
  title: 'Privacy Policy — Dofurs',
  description: 'Read the Dofurs privacy policy to understand how we collect, use, and protect your personal data.',
};

export default function PrivacyPolicyPage() {
  return (
    <ContentPageLayout
      title="Privacy Policy"
      description="How Dofurs collects, uses, shares, and safeguards your personal information."
      heroImageSrc="/Birthday/privacy_new.png"
      heroImageAlt="Privacy and trust"
    >
      <p>Effective Date: 26 February 2025</p>
      <p>Last Updated: 26 February 2025</p>

      <h2 className="mt-4 text-2xl font-semibold text-ink">1. Introduction</h2>
      <p>
        Dofurs is committed to protecting your privacy and security. This policy explains how we collect, use, share, and
        protect information when you use our website and services.
      </p>

      <h2 className="mt-4 text-2xl font-semibold text-ink">2. Information We Collect</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Account information: name, email, phone number, and password.</li>
        <li>Pet profile data: breed, age, weight, vaccination records, and medical history.</li>
        <li>Booking details: service preferences, schedule, and instructions.</li>
        <li>Payment details: processed securely via Razorpay (card data not stored on our servers).</li>
        <li>Address and location details for home visits.</li>
        <li>Device, log, cookie, and analytics data (including Google Analytics and Meta Pixel).</li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">3. How We Use Information</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>To create accounts, process bookings/payments, and deliver services.</li>
        <li>To provide support and booking communications.</li>
        <li>To personalise and improve the platform experience.</li>
        <li>To run marketing campaigns and measure performance.</li>
        <li>To comply with legal obligations and prevent fraud/security abuse.</li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">4. Sharing of Information</h2>
      <p>We do not sell personal information. We may share data with:</p>
      <ul className="list-disc space-y-2 pl-6">
        <li>Razorpay for payment processing.</li>
        <li>Google Analytics and Meta tools for analytics/advertising.</li>
        <li>Vets, groomers, and professionals fulfilling your bookings.</li>
        <li>Authorities when required by law, and during business transfers.</li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">5. Data Retention & Security</h2>
      <p>
        We retain data as long as needed for active services, legal obligations, dispute resolution, and agreement
        enforcement. On valid deletion requests, we delete or anonymise personal data within 30 days unless retention is
        legally required.
      </p>
      <p>
        Security controls include encryption in transit (SSL/TLS), access controls, secure storage practices, and regular
        monitoring.
      </p>

      <h2 className="mt-4 text-2xl font-semibold text-ink">6. Cookies & Tracking</h2>
      <p>
        We use essential, analytics, marketing, and functional cookies. You can manage cookies through browser settings,
        though some features may be affected.
      </p>

      <h2 className="mt-4 text-2xl font-semibold text-ink">7. Your Rights</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Access, correction, deletion, and consent withdrawal rights.</li>
        <li>Right to opt out of marketing communications.</li>
        <li>Requests can be sent to petcare@dofurs.in (response within 30 days).</li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">8. Additional Provisions</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Children under 18: services are not directed to minors.</li>
        <li>Third-party links: governed by third-party policies.</li>
        <li>Policy updates: continued use indicates acceptance of revisions.</li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">9. Grievance Officer & Contact</h2>
      <p>Company: Dofurs</p>
      <p>Email: petcare@dofurs.in</p>
      <p>Location: Dofurs, Bangalore, Karnataka 560100</p>
      <p>
        Grievance complaints are acknowledged within 24 hours and targeted for resolution within 30 days. This policy is
        governed by Indian law, with courts in Bengaluru, Karnataka having jurisdiction.
      </p>
    </ContentPageLayout>
  );
}
