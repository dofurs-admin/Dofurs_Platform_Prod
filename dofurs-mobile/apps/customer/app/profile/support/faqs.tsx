import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, dofursColors } from '@dofurs/shared';

type FAQItem = {
  question: string;
  answer: string;
};

const FAQS: FAQItem[] = [
  {
    question: 'How do I book doorstep pet grooming in Bengaluru on Dofurs?',
    answer:
      'Open the grooming page, choose a package, add your pet and address details, pick a preferred slot, and submit your booking. Our team confirms pincode availability before the appointment.',
  },
  {
    question: 'How are Dofurs groomers verified?',
    answer:
      'Every grooming partner is reviewed for identity, grooming experience, hygiene standards, equipment readiness, and on-platform behaviour before taking Dofurs appointments. We also track reviews and suspend partners who do not meet our quality bar.',
  },
  {
    question: 'Can I cancel or reschedule a booking?',
    answer:
      'Yes. Cancellation and rescheduling are supported under our cancellation and adjustment policy. You can make changes from your dashboard or contact support via WhatsApp, and we will adjust the schedule wherever possible.',
  },
  {
    question: 'Which grooming packages can I book?',
    answer:
      'You can book Monthly Care, Fur Bath Care, Fur Makeover, Essential Grooming, and Complete Care packages. Each package shows inclusions and starting price before you confirm.',
  },
  {
    question: 'Which areas in Bengaluru does Dofurs serve?',
    answer:
      'We currently serve most Bengaluru pincodes, including Koramangala, Indiranagar, HSR Layout, Whitefield, Jayanagar, JP Nagar, Bellandur, Marathahalli, Hebbal, and surrounding neighbourhoods. Enter your pincode in the header to confirm availability.',
  },
  {
    question: 'How do I pay for grooming on Dofurs?',
    answer:
      'You can pay securely through the Dofurs platform with Razorpay, or directly to the groomer at the time of service where available. Subscription credits apply only to eligible grooming bookings.',
  },
  {
    question: 'What if I am not satisfied with the service?',
    answer:
      'Contact us within 24 hours of the service. We work with the provider to resolve concerns and, when appropriate, offer a service redo, credit, or refund based on our service guarantee.',
  },
  {
    question: 'How do I add or edit my pet profiles?',
    answer:
      'Visit your dashboard and open Pet Profiles to add a new pet or update an existing one. You can store medical records, vaccination history, allergies, grooming preferences, and behavioural notes so groomers can prepare properly.',
  },
  {
    question: 'Is my personal and pet information secure?',
    answer:
      'Yes. We use industry-standard encryption, strict access controls, and row-level security on the database. Personal data and pet health information are never shared with third parties without your consent.',
  },
  {
    question: 'How do I become a grooming partner on Dofurs?',
    answer:
      'Click Join us as a service provider in the navigation, or visit the provider application form. We are currently prioritising qualified grooming professionals with verified experience, hygiene readiness, and strong handling standards.',
  },
];

export default function CustomerSupportFaqsScreen() {
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <Screen scroll>
      <Text style={styles.title}>Pet Grooming FAQs - Dofurs Bengaluru</Text>
      <Text style={styles.subtitle}>
        Everything you need to know about doorstep grooming bookings, packages, verification, payments, coverage areas, and support.
      </Text>

      <View style={styles.faqWrap}>
        {FAQS.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <View key={item.question} style={styles.faqCard}>
              <Pressable
                onPress={() => setOpenIndex((current) => (current === index ? null : index))}
                style={styles.faqQuestionRow}
              >
                <Text style={styles.faqQuestion}>{item.question}</Text>
                <Ionicons
                  name={isOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={18}
                  color="#6b6b6b"
                />
              </Pressable>

              {isOpen ? <Text style={styles.faqAnswer}>{item.answer}</Text> : null}
            </View>
          );
        })}
      </View>

      <Pressable style={styles.secondaryButton} onPress={() => router.push('/profile/support/contact')}>
        <Text style={styles.secondaryButtonLabel}>Still need help? Contact support</Text>
      </Pressable>

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonLabel}>Back</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: dofursColors.ink,
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#5d5853',
    fontSize: 13,
  },
  faqWrap: {
    gap: 10,
  },
  faqCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f1e6da',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  faqQuestion: {
    flex: 1,
    color: dofursColors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  faqAnswer: {
    color: '#6b6b6b',
    fontSize: 13,
    lineHeight: 20,
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  secondaryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  backButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#fff8f0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  backButtonLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
});
