import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ApiError,
  AuthScreenShell,
  authFormStyles,
  bootstrapProfile,
  completeProfile,
  getSupabaseClient,
  getUserProfile,
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
    <AuthScreenShell
      badge="Profile Setup"
      title="Tell us about you"
      subtitle="We need a few details before you can start booking and managing pet care seamlessly."
      highlights={['One-time setup', 'Securely stored', 'Editable anytime']}
    >
      <Text style={authFormStyles.sectionEyebrow}>Finalize account</Text>
      <Text style={authFormStyles.sectionTitle}>Complete your profile</Text>
      <Text style={authFormStyles.sectionSubtitle}>Add your details to unlock bookings, credits, and faster checkout.</Text>

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
        onPress={handleCompleteProfile}
      >
        <Text style={authFormStyles.primaryButtonLabel}>{loading ? 'Saving...' : 'Continue to app'}</Text>
      </Pressable>
    </AuthScreenShell>
  );
}

