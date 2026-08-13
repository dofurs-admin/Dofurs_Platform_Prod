import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ApiError,
  AuthScreenShell,
  authFormStyles,
  bootstrapProfile,
  getSupabaseClient,
  getUserProfile,
  resolveProviderAppRoute,
  signOutAndResetClientState,
  useAuthStore,
} from '@dofurs/shared';

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; intent?: string }>();
  const setRole = useAuthStore((state) => state.setRole);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const email = typeof params.email === 'string' ? params.email : '';
  const intent = params.intent === 'sign-up' ? 'sign-up' : 'sign-in';

  async function bootstrapAndRoute() {
    try {
      await bootstrapProfile();
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 409)) {
        throw err;
      }
    }

    const profileResult = await getUserProfile();
    const roleName = profileResult.profile?.roles?.name ?? null;
    setRole(roleName);

    const route = resolveProviderAppRoute(roleName);

    if (route === '/(auth)/sign-in') {
      await signOutAndResetClientState();
    }

    router.replace(route);
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

      await bootstrapAndRoute();
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to verify account (${err.status}).`);
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
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: intent === 'sign-up',
        },
      });

      if (otpError) {
        setError(otpError.message || 'Could not resend OTP.');
      }
    } catch {
      setError('Unable to resend OTP right now.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenShell
      badge="Security Check"
      title="Almost there"
      subtitle={`Enter the 6-digit code sent to ${email || 'your email'} to continue.`}
      highlights={['Quick verification', 'Secure session', 'No passwords']}
    >
      <Text style={authFormStyles.sectionEyebrow}>OTP verification</Text>
      <Text style={authFormStyles.sectionTitle}>Confirm your code</Text>
      <Text style={authFormStyles.sectionSubtitle}>Make sure the OTP is entered exactly as received.</Text>

      <View style={authFormStyles.fieldGroup}>
        <Text style={authFormStyles.fieldLabel}>6-digit OTP</Text>
        <TextInput
          keyboardType="number-pad"
          maxLength={6}
          placeholder="123456"
          placeholderTextColor="#9b8f87"
          style={authFormStyles.otpInput}
          value={otp}
          onChangeText={setOtp}
        />
      </View>

      {error ? <Text style={authFormStyles.errorText}>{error}</Text> : null}

      <Pressable
        style={[authFormStyles.primaryButton, loading && authFormStyles.primaryButtonDisabled]}
        disabled={loading}
        onPress={handleVerifyOtp}
      >
        <Text style={authFormStyles.primaryButtonLabel}>{loading ? 'Verifying...' : 'Verify OTP'}</Text>
      </Pressable>

      <Pressable style={authFormStyles.secondaryButton} onPress={handleResendOtp} disabled={loading}>
        <Text style={authFormStyles.secondaryButtonLabel}>Resend OTP</Text>
      </Pressable>
    </AuthScreenShell>
  );
}

