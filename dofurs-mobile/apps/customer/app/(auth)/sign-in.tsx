import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { dofursColors, getSupabaseClient } from '@dofurs/shared';
import { Screen } from '@dofurs/shared';
import { useAuthStore } from '@dofurs/shared';

export default function CustomerSignInScreen() {
  const router = useRouter();
  const setSignupDraft = useAuthStore((state) => state.setSignupDraft);
  const setRequiresProfileSetup = useAuthStore((state) => state.setRequiresProfileSetup);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  async function handleSendOtp() {
    setError(null);

    if (!normalizedEmail) {
      setError('Enter your email address.');
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: false,
        },
      });

      if (otpError) {
        setError(otpError.message || 'Could not send OTP.');
        return;
      }

      setSignupDraft(null);
      setRequiresProfileSetup(false);

      router.push({
        pathname: '/(auth)/verify-otp',
        params: { email: normalizedEmail, intent: 'sign-in' },
      });
    } catch {
      setError('Unable to send OTP right now.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Sign in to Dofurs Customer</Text>
        <Text style={styles.subtitle}>Use your email OTP to continue.</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.button, loading && styles.buttonDisabled]} disabled={loading} onPress={handleSendOtp}>
          <Text style={styles.buttonLabel}>{loading ? 'Sending OTP...' : 'Send OTP'}</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.push('/(auth)/sign-up')}>
          <Text style={styles.secondaryButtonLabel}>New to Dofurs? Create account</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 48,
    borderRadius: 20,
    backgroundColor: '#fff8f0',
    borderWidth: 1,
    borderColor: '#e7c4a7',
    padding: 20,
    gap: 10,
  },
  title: {
    color: dofursColors.ink,
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#4f4b47',
    fontSize: 14,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    color: dofursColors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  error: {
    color: dofursColors.error,
    fontSize: 13,
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
});
