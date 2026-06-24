import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthScreenShell, authFormStyles, getSupabaseClient } from '@dofurs/shared';
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
    <AuthScreenShell
      badge="Dofurs"
      title="Doorstep Pet Grooming, From Verified Groomers Across Bengaluru"
      subtitle="Trusted by 100+ pet parents. Compare grooming packages, check inclusions, and book a verified groomer for a home visit."
    >
      <Text style={authFormStyles.sectionEyebrow}>Welcome back</Text>
      <Text style={authFormStyles.sectionTitle}>Sign in to Dofurs</Text>
      <Text style={authFormStyles.sectionSubtitle}>Use the email linked to your Dofurs account.</Text>

      <View style={authFormStyles.fieldGroup}>
        <Text style={authFormStyles.fieldLabel}>Email address</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor="#9b8f87"
          style={authFormStyles.input}
          value={email}
          onChangeText={setEmail}
        />
      </View>

      {error ? <Text style={authFormStyles.errorText}>{error}</Text> : null}

      <Pressable
        style={[authFormStyles.primaryButton, loading && authFormStyles.primaryButtonDisabled]}
        disabled={loading}
        onPress={handleSendOtp}
      >
        <Text style={authFormStyles.primaryButtonLabel}>{loading ? 'Sending OTP...' : 'Send OTP'}</Text>
      </Pressable>

      <Text style={authFormStyles.helperText}>We will send a 6-digit code to your email to verify your identity.</Text>

      <Pressable style={authFormStyles.secondaryButton} onPress={() => router.push('/(auth)/sign-up')}>
        <Text style={authFormStyles.secondaryButtonLabel}>New to Dofurs? Create account</Text>
      </Pressable>
    </AuthScreenShell>
  );
}

