import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, dofursColors } from '@dofurs/shared';

const faqs = [
  {
    question: 'How do I reschedule a booking?',
    answer: 'Open your booking details and choose a new date/time if the provider availability allows changes.',
  },
  {
    question: 'When are refunds processed?',
    answer: 'Eligible refunds are initiated after cancellation checks and typically settle as per your payment provider timeline.',
  },
  {
    question: 'How can I update pet profile information?',
    answer: 'Go to Pets, open your pet profile, then use Edit to update breed, age, allergy notes, or passport details.',
  },
];

export default function PlaceholderScreen() {
  const router = useRouter();

  return (
    <Screen scroll>
      <Text style={styles.title}>Help center</Text>
      <Text style={styles.subtitle}>Common support topics and quick actions.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Need direct help?</Text>

        <Pressable style={styles.linkRow} onPress={() => router.push('/messages')}>
          <Text style={styles.linkLabel}>Open support messages</Text>
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => router.push('/notifications')}>
          <Text style={styles.linkLabel}>Check recent notifications</Text>
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => router.push('/profile/settings')}>
          <Text style={styles.linkLabel}>Go to account settings</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>FAQs</Text>

        {faqs.map((item) => (
          <View key={item.question} style={styles.faqCard}>
            <Text style={styles.faqQuestion}>{item.question}</Text>
            <Text style={styles.faqAnswer}>{item.answer}</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonLabel}>Back</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: dofursColors.ink,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#5d5853',
    fontSize: 13,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  linkRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#edd7c6',
    backgroundColor: '#fffdfb',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkLabel: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  faqCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#edd7c6',
    backgroundColor: '#fffdfb',
    padding: 10,
    gap: 4,
  },
  faqQuestion: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  faqAnswer: {
    color: '#5d5853',
    fontSize: 12,
    lineHeight: 18,
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
});
