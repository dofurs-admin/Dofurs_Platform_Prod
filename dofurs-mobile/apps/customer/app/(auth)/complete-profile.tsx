import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
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

export default function CustomerCompleteProfileScreen() {
  const router = useRouter();
  const signupDraft = useAuthStore((state) => state.signupDraft);
  const setSignupDraft = useAuthStore((state) => state.setSignupDraft);
  const setRole = useAuthStore((state) => state.setRole);
  const setRequiresProfileSetup = useAuthStore((state) => state.setRequiresProfileSetup);
  const [name, setName] = useState(signupDraft?.name ?? '');
  const [email, setEmail] = useState(signupDraft?.email ?? '');
  const [phone, setPhone] = useState(signupDraft?.phone ?? '');
  const [referralCode, setReferralCode] = useState(signupDraft?.referralCode ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const normalizedPhone = useMemo(() => normalizeIndianPhone(phone), [phone]);

  useEffect(() => {
    let active = true;

    async function hydrateEmail() {
      if (normalizedEmail) {
        return;
      }

      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const sessionEmail = data.session?.user?.email?.trim().toLowerCase();

      if (active && sessionEmail) {
        setEmail(sessionEmail);
      }
    }

    hydrateEmail();

    return () => {
      active = false;
    };
  }, [normalizedEmail]);

  async function handleCompleteProfile() {
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
      await completeProfile({
        name: trimmedName,
        email: normalizedEmail,
        phone: normalizedPhone,
        referralCode: referralCode.trim() || null,
      });

      await bootstrapProfile();
      const profileResult = await getUserProfile();
      setRole(profileResult.profile?.roles?.name ?? null);
      setRequiresProfileSetup(false);
      setSignupDraft(null);
      router.replace('/(tabs)/home');
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to complete profile (${err.status}).`);
      } else {
        setError('Unable to complete profile right now.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Complete your profile</Text>
        <Text style={styles.subtitle}>Add your details to start booking pet services.</Text>

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

        <Pressable style={[styles.button, loading && styles.buttonDisabled]} disabled={loading} onPress={handleCompleteProfile}>
          <Text style={styles.buttonLabel}>{loading ? 'Saving...' : 'Continue to app'}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 36,
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
});
