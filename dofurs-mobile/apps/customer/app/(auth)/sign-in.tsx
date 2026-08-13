import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getSupabaseClient, useAuthStore } from '@dofurs/shared';
import {
  AuthBottomSwitch,
  AuthErrorMessage,
  AuthInputField,
  AuthPrimaryButton,
  AuthScaffold,
  AuthSectionHeader,
  AuthSupportText,
  useLockBodyScrollOnWeb,
} from '../../components/auth/auth-ui';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CustomerSignInScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const setSignupDraft = useAuthStore((state) => state.setSignupDraft);
  const setRequiresProfileSetup = useAuthStore((state) => state.setRequiresProfileSetup);
  const initialEmail = typeof params.email === 'string' ? params.email : '';
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  useLockBodyScrollOnWeb();

  async function handleSendOtp() {
    setEmailError(null);
    setFormError(null);

    if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
      setEmailError('Enter a valid email address.');
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
        setFormError(otpError.message || 'Could not send OTP.');
        return;
      }

      setSignupDraft(null);
      setRequiresProfileSetup(false);

      router.push({
        pathname: '/(auth)/verify-otp',
        params: { email: normalizedEmail, intent: 'sign-in' },
      });
    } catch {
      setFormError('Unable to send OTP right now.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScaffold
      showBrandTagline={false}
      centered
      footer={
        <AuthBottomSwitch
          prompt="New to Dofurs?"
          actionLabel="Create an account"
          onPress={() => router.push('/(auth)/sign-up')}
          disabled={loading}
        />
      }
    >
      <AuthSectionHeader
        eyebrow="WELCOME BACK"
        title="Log in to Dofurs"
        subtitle="Enter your email to continue."
      />

      <AuthInputField
        label="Email address"
        value={email}
        onChangeText={(next) => {
          setEmail(next);
          if (emailError) {
            setEmailError(null);
          }
          if (formError) {
            setFormError(null);
          }
        }}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        autoFocus
        returnKeyType="send"
        onSubmitEditing={handleSendOtp}
        error={emailError}
      />

      {formError ? <AuthErrorMessage message={formError} /> : null}

      <AuthPrimaryButton
        label="Send OTP ->"
        loadingLabel="Sending OTP..."
        loading={loading}
        onPress={handleSendOtp}
      />

      <AuthSupportText text="We'll send a 6-digit code to your email to verify your identity." />
    </AuthScaffold>
  );
}

