import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, dofursColors } from '@dofurs/shared';

export default function CustomerOnboardingScreen() {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Welcome to Dofurs</Text>
        <Text style={styles.subtitle}>Book trusted pet care with OTP-based login in a few steps.</Text>

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
  card: {
    marginTop: 60,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 20,
    gap: 14,
  },
  title: {
    color: dofursColors.ink,
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    color: '#5d5853',
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    marginTop: 6,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: dofursColors.coral,
    paddingVertical: 12,
  },
  primaryButtonLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
  },
  secondaryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 15,
    fontWeight: '600',
  },
});
