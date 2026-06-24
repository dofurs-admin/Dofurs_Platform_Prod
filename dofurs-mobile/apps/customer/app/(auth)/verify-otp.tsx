import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ApiError,
  bootstrapProfile,
  completeProfile,
  dofursColors,
  getSupabaseClient,
  getUserProfile,
  useAuthStore,
} from '@dofurs/shared';
import { Screen } from '@dofurs/shared';

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; intent?: string }>();
  const signupDraft = useAuthStore((state) => state.signupDraft);
  const setSignupDraft = useAuthStore((state) => state.setSignupDraft);
  const setRole = useAuthStore((state) => state.setRole);
  const setRequiresProfileSetup = useAuthStore((state) => state.setRequiresProfileSetup);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const email = typeof params.email === 'string' ? params.email : '';
  const intent = params.intent === 'sign-up' ? 'sign-up' : 'sign-in';

  async function bootstrapAndRoute() {
    try {
      await bootstrapProfile();
      const profileResult = await getUserProfile();
      setRole(profileResult.profile?.roles?.name ?? null);
      setRequiresProfileSetup(false);
      setSignupDraft(null);
      router.replace('/(tabs)/home');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const requiresProfileSetup =
          typeof err.details === 'object' &&
          err.details !== null &&
          'requiresProfileSetup' in err.details &&
          Boolean((err.details as { requiresProfileSetup?: unknown }).requiresProfileSetup);

        if (requiresProfileSetup) {
          setRequiresProfileSetup(true);
          router.replace('/(auth)/complete-profile');
          return;
        }
      }

      setRequiresProfileSetup(false);
      router.replace('/(tabs)/home');
    }
  }

  async function handleVerifyOtp() {
    setError(null);

    if (!email) {
      setError('Missing email context. Go back and request OTP again.');
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter the 6-digit OTP.');
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp.trim(),
        type: 'email',
      });

      if (verifyError) {
        setError(verifyError.message || 'OTP verification failed.');
        return;
      }

      if (intent === 'sign-up') {
        if (!signupDraft) {
          setRequiresProfileSetup(true);
          router.replace('/(auth)/complete-profile');
          return;
        }

        await completeProfile({
          name: signupDraft.name,
          email: signupDraft.email,
          phone: signupDraft.phone,
          referralCode: signupDraft.referralCode ?? null,
        });
      }

      await bootstrapAndRoute();
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Verification failed (${err.status}).`);
      } else {
        setError('Unable to verify OTP right now.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    setError(null);

    if (!email) {
      setError('Missing email context. Go back and request OTP again.');
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      const shouldCreateUser = intent === 'sign-up';
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser,
          data: shouldCreateUser
            ? {
                name: signupDraft?.name,
                phone: signupDraft?.phone,
                phone_number: signupDraft?.phone,
                referralCode: signupDraft?.referralCode ?? undefined,
              }
            : undefined,
        },
      });

      if (otpError) {
        setError(otpError.message || 'Could not resend OTP.');
        return;
      }
    } catch {
      setError('Unable to resend OTP right now.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.subtitle}>Enter the OTP sent to {email || 'your email'}.</Text>
        <TextInput
          keyboardType="number-pad"
          maxLength={6}
          placeholder="123456"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={otp}
          onChangeText={setOtp}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.button, loading && styles.buttonDisabled]} disabled={loading} onPress={handleVerifyOtp}>
          <Text style={styles.buttonLabel}>{loading ? 'Verifying...' : 'Verify OTP'}</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={handleResendOtp} disabled={loading}>
          <Text style={styles.secondaryButtonLabel}>Resend OTP</Text>
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
    letterSpacing: 2,
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
