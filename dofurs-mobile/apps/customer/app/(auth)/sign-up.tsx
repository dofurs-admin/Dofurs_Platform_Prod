import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ApiError,
  AuthScreenShell,
  authFormStyles,
  getSupabaseClient,
  preSignup,
  useAuthStore,
} from '@dofurs/shared';

function normalizeIndianPhone(value: string) {
  const compact = value.replace(/[\s()-]+/g, '');

  if (/^\+91\d{10}$/.test(compact)) {
    return compact;
  }

  if (/^91\d{10}$/.test(compact)) {
    return `+${compact}`;
  }

  if (/^\d{10}$/.test(compact)) {
    return `+91${compact}`;
  }

  return '';
}

export default function CustomerSignUpScreen() {
  const router = useRouter();
  const setSignupDraft = useAuthStore((state) => state.setSignupDraft);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const normalizedPhone = useMemo(() => normalizeIndianPhone(phone), [phone]);

  async function handleSendOtp() {
    setError(null);

    const trimmedName = name.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setError('Enter your full name.');
      return;
    }

    if (!normalizedEmail) {
      setError('Enter a valid email address.');
      return;
    }

    if (!normalizedPhone) {
      setError('Enter a valid Indian mobile number.');
      return;
    }

    setLoading(true);

    try {
      await preSignup({
        name: trimmedName,
        email: normalizedEmail,
        phone: normalizedPhone,
        referralCode: referralCode.trim() || null,
      });

      const supabase = getSupabaseClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          data: {
            name: trimmedName,
            phone: normalizedPhone,
            phone_number: normalizedPhone,
            referralCode: referralCode.trim() || undefined,
          },
        },
      });

      if (otpError) {
        setError(otpError.message || 'Could not send OTP.');
        return;
      }

      setSignupDraft({
        name: trimmedName,
        email: normalizedEmail,
        phone: normalizedPhone,
        referralCode: referralCode.trim() || null,
      });

      router.push({
        pathname: '/(auth)/verify-otp',
        params: { email: normalizedEmail, intent: 'sign-up' },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        const details = err.details as { error?: string } | null;
        setError(details?.error || `Sign-up failed (${err.status}).`);
      } else {
        setError('Unable to start sign-up right now.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenShell
      badge="Dofurs"
      title="Doorstep Pet Grooming, From Verified Groomers Across Bengaluru"
      subtitle="Trusted by 100+ pet parents. Compare grooming packages, check inclusions, and book a verified groomer for a home visit."
      highlights={['Doorstep grooming', 'Background-verified', 'Pet-safe products']}
    >
      <Text style={authFormStyles.sectionEyebrow}>Create account</Text>
      <Text style={authFormStyles.sectionTitle}>Create your Dofurs account</Text>
      <Text style={authFormStyles.sectionSubtitle}>Enter your details and we will send an OTP to your email.</Text>

      <View style={authFormStyles.fieldGroup}>
        <Text style={authFormStyles.fieldLabel}>Full name</Text>
        <TextInput
          autoCapitalize="words"
          placeholder="Aarav Mehta"
          placeholderTextColor="#9b8f87"
          style={authFormStyles.input}
          value={name}
          onChangeText={setName}
        />
      </View>

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

      <View style={authFormStyles.fieldGroup}>
        <Text style={authFormStyles.fieldLabel}>Phone number</Text>
        <TextInput
          keyboardType="phone-pad"
          placeholder="+91XXXXXXXXXX"
          placeholderTextColor="#9b8f87"
          style={authFormStyles.input}
          value={phone}
          onChangeText={setPhone}
        />
      </View>

      <View style={authFormStyles.fieldGroup}>
        <Text style={authFormStyles.fieldLabel}>Referral code (optional)</Text>
        <TextInput
          autoCapitalize="characters"
          placeholder="DOFURS50"
          placeholderTextColor="#9b8f87"
          style={authFormStyles.input}
          value={referralCode}
          onChangeText={setReferralCode}
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

      <Pressable style={authFormStyles.secondaryButton} onPress={() => router.push('/(auth)/sign-in')}>
        <Text style={authFormStyles.secondaryButtonLabel}>Already have an account? Sign in</Text>
      </Pressable>
    </AuthScreenShell>
  );
}

