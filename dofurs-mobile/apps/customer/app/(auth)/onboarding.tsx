import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, dofursColors } from '@dofurs/shared';

export default function CustomerOnboardingScreen() {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>Dofurs</Text>
        </View>
        <Text style={styles.title}>Doorstep Pet Grooming, From Verified Groomers Across Bengaluru</Text>
        <Text style={styles.subtitle}>Trusted by 100+ pet parents. Compare grooming packages, check inclusions, and book a verified groomer for a home visit.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.featureRow}>
          <Text style={styles.featureChip}>Doorstep grooming</Text>
          <Text style={styles.featureChip}>Background-verified</Text>
          <Text style={styles.featureChip}>Safe for anxious pets</Text>
          <Text style={styles.featureChip}>Pet-safe products</Text>
        </View>

        <Pressable style={styles.primaryButton} onPress={() => router.push('/(auth)/sign-up')}>
          <Text style={styles.primaryButtonLabel}>Create Account</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.push('/(auth)/sign-in')}>
          <Text style={styles.secondaryButtonLabel}>I already have an account</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: 16,
    gap: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#efcba9',
    backgroundColor: '#fff1e1',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeLabel: {
    color: '#9b5f2f',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  card: {
    marginTop: 18,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fffaf5',
    padding: 20,
    gap: 14,
    shadowColor: '#c28953',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  title: {
    color: dofursColors.ink,
    fontSize: 31,
    fontWeight: '800',
    lineHeight: 37,
  },
  subtitle: {
    color: '#5d5853',
    fontSize: 15,
    lineHeight: 22,
  },
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff7ee',
    color: '#6f5c4d',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  primaryButton: {
    marginTop: 6,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: dofursColors.coral,
    paddingVertical: 13,
  },
  primaryButtonLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingVertical: 13,
  },
  secondaryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
});
