import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError, dofursColors, getSupabaseClient, preSignup, useAuthStore } from '@dofurs/shared';
import { Screen } from '@dofurs/shared';

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
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Create your Dofurs account</Text>
        <Text style={styles.subtitle}>We will send an OTP to your email to verify your account.</Text>

        <TextInput
          autoCapitalize="words"
          placeholder="Full name"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={name}
          onChangeText={setName}
        />

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

        <TextInput
          keyboardType="phone-pad"
          placeholder="+91XXXXXXXXXX"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
        />

        <TextInput
          autoCapitalize="characters"
          placeholder="Referral code (optional)"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={referralCode}
          onChangeText={setReferralCode}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.button, loading && styles.buttonDisabled]} disabled={loading} onPress={handleSendOtp}>
          <Text style={styles.buttonLabel}>{loading ? 'Sending OTP...' : 'Send OTP'}</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.push('/(auth)/sign-in')}>
          <Text style={styles.secondaryButtonLabel}>Already have an account? Sign in</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 32,
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
    paddingVertical: 8,
  },
  secondaryButtonLabel: {
    color: '#5d5853',
    fontSize: 13,
    fontWeight: '600',
  },
});
