import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ApiError,
  bootstrapProfile,
  completeProfile,
  dofursColors,
  getSupabaseClient,
  getUserProfile,
  isCustomerAppRole,
  requiresProfileSetupFromError,
  signOutAndResetClientState,
  useAuthStore,
} from '@dofurs/shared';
import {
  AuthBottomSwitch,
  AuthErrorMessage,
  AuthPrimaryButton,
  AuthScaffold,
  AuthSectionHeader,
  OtpBoxesInput,
  useLockBodyScrollOnWeb,
} from '../../components/auth/auth-ui';

const OTP_LENGTH = 6;
const RESEND_COUNTDOWN_SECONDS = 24;

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; intent?: string }>();
  const signupDraft = useAuthStore((state) => state.signupDraft);
  const setSignupDraft = useAuthStore((state) => state.setSignupDraft);
  const setRole = useAuthStore((state) => state.setRole);
  const setRequiresProfileSetup = useAuthStore((state) => state.setRequiresProfileSetup);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendInSeconds, setResendInSeconds] = useState(RESEND_COUNTDOWN_SECONDS);

  useLockBodyScrollOnWeb();

  const email = typeof params.email === 'string' ? params.email : '';
  const intent = params.intent === 'sign-up' ? 'sign-up' : 'sign-in';

  useEffect(() => {
    if (resendInSeconds <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setResendInSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendInSeconds]);

  async function bootstrapAndRoute() {
    try {
      await bootstrapProfile();
      const profileResult = await getUserProfile();
      const roleName = profileResult.profile?.roles?.name ?? null;
      setRole(roleName);

      if (!isCustomerAppRole(roleName)) {
        await signOutAndResetClientState();
        setRequiresProfileSetup(false);
        router.replace('/(auth)/sign-in');
        return;
      }

      setRequiresProfileSetup(false);
      setSignupDraft(null);
      router.replace('/(tabs)/home');
    } catch (err) {
      if (requiresProfileSetupFromError(err)) {
        setRequiresProfileSetup(true);
        router.replace('/(auth)/complete-profile');
        return;
      }

      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        await signOutAndResetClientState();
        setRequiresProfileSetup(false);
        router.replace('/(auth)/sign-in');
        return;
      }

      throw err;
    }
  }

  async function handleVerifyOtp(codeOverride?: string) {
    const code = (codeOverride ?? otpCode).trim();

    setOtpError(null);
    setFormError(null);

    if (!email) {
      setFormError('Missing email context. Go back and request OTP again.');
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setOtpError('Enter a valid 6-digit OTP.');
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });

      if (verifyError) {
        setFormError(verifyError.message || 'OTP verification failed.');
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
        const detail =
          typeof err.details === 'object' && err.details !== null
            ? (err.details as { error?: string })
            : null;

        if (err.status === 0) {
          setFormError('Could not reach Dofurs right now. Please check your connection and try again.');
        } else {
          setFormError(detail?.error ?? `Verification failed (${err.status}).`);
        }
      } else if (err instanceof Error) {
        const isConnectivityIssue = /failed to fetch|network|connection/i.test(err.message);
        setFormError(
          isConnectivityIssue
            ? 'Could not reach Dofurs right now. Please check your connection and try again.'
            : err.message || 'Unable to verify OTP right now.',
        );
      } else {
        setFormError('Unable to verify OTP right now.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(nextValue: string) {
    setOtpCode(nextValue);
    if (otpError) {
      setOtpError(null);
    }
    if (formError) {
      setFormError(null);
    }

    if (nextValue.length === OTP_LENGTH && !loading) {
      void handleVerifyOtp(nextValue);
    }
  }

  async function handleResendOtp() {
    setFormError(null);

    if (!email) {
      setFormError('Missing email context. Go back and request OTP again.');
      return;
    }

    if (resendInSeconds > 0) {
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
        setFormError(otpError.message || 'Could not resend OTP.');
        return;
      }

      setResendInSeconds(RESEND_COUNTDOWN_SECONDS);
    } catch {
      setFormError('Unable to resend OTP right now.');
    } finally {
      setLoading(false);
    }
  }

  const resendDisabled = loading || resendInSeconds > 0;
  const resendHint =
    resendInSeconds > 0
      ? `Didn't receive it? Resend in ${resendInSeconds}s`
      : "Didn't receive it?";

  const switchPrompt = intent === 'sign-up' ? 'Already have an account?' : 'Need an account?';
  const switchLabel = intent === 'sign-up' ? 'Log in' : 'Create an account';
  const switchRoute = intent === 'sign-up' ? '/(auth)/sign-in' : '/(auth)/sign-up';

  function handleUseDifferentEmail() {
    const targetRoute = intent === 'sign-up' ? '/(auth)/sign-up' : '/(auth)/sign-in';
    router.replace({ pathname: targetRoute, params: { email } });
  }

  return (
    <AuthScaffold
      showBrandTagline={false}
      centered
      footer={
        <AuthBottomSwitch
          prompt={switchPrompt}
          actionLabel={switchLabel}
          onPress={() => router.push(switchRoute)}
          disabled={loading}
        />
      }
    >
      <AuthSectionHeader
        eyebrow="OTP VERIFICATION"
        title="Check your email"
        subtitle="We've sent a 6-digit verification code to"
      />

      <View style={styles.emailBadge}>
        <Text style={styles.emailBadgeText}>{email || 'your email'}</Text>
      </View>

      <OtpBoxesInput value={otpCode} onChangeValue={handleOtpChange} error={otpError} disabled={loading} />

      {formError ? <AuthErrorMessage message={formError} /> : null}

      <AuthPrimaryButton
        label="Verify code ->"
        loadingLabel="Verifying..."
        loading={loading}
        onPress={() => {
          void handleVerifyOtp();
        }}
      />

      <View style={styles.metaActions}>
        <Text style={styles.metaHint}>{resendHint}</Text>

        {resendInSeconds > 0 ? (
          <Text style={styles.metaCountdown}>{resendInSeconds}s</Text>
        ) : (
          <Pressable onPress={() => void handleResendOtp()} disabled={resendDisabled}>
            <Text style={[styles.metaActionLink, resendDisabled && styles.metaActionLinkDisabled]}>Resend OTP</Text>
          </Pressable>
        )}

        <Pressable onPress={handleUseDifferentEmail} disabled={loading}>
          <Text style={[styles.metaActionLink, loading && styles.metaActionLinkDisabled]}>Use a different email</Text>
        </Pressable>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  emailBadge: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ead5c3',
    backgroundColor: '#fff6ec',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  emailBadgeText: {
    color: '#4a3c33',
    fontSize: 14,
    fontWeight: '600',
  },
  metaActions: {
    alignItems: 'center',
    gap: 8,
  },
  metaHint: {
    color: '#756255',
    fontSize: 12,
  },
  metaCountdown: {
    color: '#8f7a6a',
    fontSize: 12,
    fontWeight: '600',
  },
  metaActionLink: {
    color: dofursColors.coralDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  metaActionLinkDisabled: {
    opacity: 0.65,
  },
});

