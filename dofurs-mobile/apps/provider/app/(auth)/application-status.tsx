import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError, dofursColors, getUserProfile, Screen, useAuthStore } from '@dofurs/shared';

export default function ProviderApplicationStatusScreen() {
  const router = useRouter();
  const setRole = useAuthStore((state) => state.setRole);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckStatus() {
    setError(null);
    setChecking(true);

    try {
      const profileResult = await getUserProfile();
      const roleName = profileResult.profile?.roles?.name ?? null;
      setRole(roleName);

      if (roleName === 'provider' || roleName === 'admin' || roleName === 'staff') {
        router.replace('/(tabs)/home');
        return;
      }

      setError('Application is still under review. We will notify you once approved.');
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to check status (${err.status}).`);
      } else {
        setError('Unable to check status right now.');
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Application submitted</Text>
        <Text style={styles.subtitle}>
          Thanks for applying to Dofurs. Our onboarding team will review your profile and verify your details.
        </Text>

        <Pressable style={[styles.button, checking && styles.buttonDisabled]} onPress={handleCheckStatus} disabled={checking}>
          <Text style={styles.buttonLabel}>{checking ? 'Checking...' : 'Check approval status'}</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.replace('/(auth)/sign-in')}>
          <Text style={styles.secondaryButtonLabel}>Back to sign in</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 60,
    borderRadius: 20,
    backgroundColor: '#fff8f0',
    borderWidth: 1,
    borderColor: '#e7c4a7',
    padding: 20,
    gap: 12,
  },
  title: {
    color: dofursColors.ink,
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#4f4b47',
    fontSize: 14,
    lineHeight: 22,
  },
  button: {
    backgroundColor: dofursColors.coral,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  secondaryButtonLabel: {
    color: '#5d5853',
    fontSize: 13,
    fontWeight: '600',
  },
  error: {
    color: dofursColors.warning,
    fontSize: 13,
  },
});
