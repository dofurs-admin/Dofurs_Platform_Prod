import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ApiError,
  dofursColors,
  getUserProfile,
  resolveProviderAppRoute,
  Screen,
  signOutAndResetClientState,
  useAuthStore,
} from '@dofurs/shared';

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

      const route = resolveProviderAppRoute(roleName);

      if (route === '/(tabs)/home') {
        router.replace(route);
        return;
      }

      if (route === '/(auth)/sign-in') {
        await signOutAndResetClientState();
        router.replace(route);
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
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>Application received</Text>
        </View>
        <Text style={styles.heroTitle}>Thanks for applying to Dofurs</Text>
        <Text style={styles.heroSubtitle}>Our onboarding team is reviewing your details, service fit, and coverage before approval.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Current status</Text>
        <Text style={styles.subtitle}>Review in progress. You can check again after a few minutes.</Text>

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
  hero: {
    marginTop: 16,
    gap: 10,
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
  heroTitle: {
    color: dofursColors.ink,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
  },
  heroSubtitle: {
    color: '#5d5853',
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    marginTop: 14,
    borderRadius: 28,
    backgroundColor: '#fffaf5',
    borderWidth: 1,
    borderColor: '#e7c4a7',
    padding: 20,
    gap: 12,
    shadowColor: '#c28953',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  title: {
    color: dofursColors.ink,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: '#5a4c41',
    fontSize: 14,
    lineHeight: 22,
  },
  button: {
    backgroundColor: dofursColors.coral,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
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
