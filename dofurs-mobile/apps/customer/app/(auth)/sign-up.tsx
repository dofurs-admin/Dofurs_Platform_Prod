import { useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ApiError,
  getSupabaseClient,
  preSignup,
  useAuthStore,
} from '@dofurs/shared';
import {
  AuthBottomSwitch,
  AuthErrorMessage,
  AuthInputField,
  AuthPrimaryButton,
  AuthScaffold,
  AuthSectionHeader,
  useLockBodyScrollOnWeb,
} from '../../components/auth/auth-ui';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatIndianPhoneInput(value: string) {
  const digits = value.replace(/\D+/g, '').slice(0, 10);

  if (digits.length <= 5) {
    return digits;
  }

  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}

function normalizeIndianPhone(value: string) {
  const compact = value.replace(/\D+/g, '');
  if (compact.length !== 10) {
    return '';
  }

  return `+91${compact}`;
}

export default function CustomerSignUpScreen() {
  const router = useRouter();
  const setSignupDraft = useAuthStore((state) => state.setSignupDraft);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showReferralField, setShowReferralField] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const referralFadeAnim = useRef(new Animated.Value(0)).current;

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const normalizedPhone = useMemo(() => normalizeIndianPhone(phoneInput), [phoneInput]);
  useLockBodyScrollOnWeb();

  function revealReferralField() {
    if (showReferralField) {
      return;
    }

    setShowReferralField(true);
    referralFadeAnim.setValue(0);
    Animated.timing(referralFadeAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }

  async function handleSendOtp() {
    setNameError(null);
    setEmailError(null);
    setPhoneError(null);
    setFormError(null);

    const trimmedName = name.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setNameError('Enter your full name.');
      return;
    }

    if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
      setEmailError('Enter a valid email address.');
      return;
    }

    if (!normalizedPhone) {
      setPhoneError('Enter a valid Indian mobile number.');
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
        setFormError(otpError.message || 'Could not send OTP.');
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
        setFormError(details?.error || `Sign-up failed (${err.status}).`);
      } else {
        setFormError('Unable to start sign-up right now.');
      }
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
          prompt="Already have an account?"
          actionLabel="Log in"
          onPress={() => router.push('/(auth)/sign-in')}
          disabled={loading}
        />
      }
    >
      <AuthSectionHeader
        eyebrow="CREATE ACCOUNT"
        title="Create your Dofurs account"
        subtitle="Enter your details and we'll send you an OTP."
      />

      <AuthInputField
        label="Full name"
        value={name}
        onChangeText={(next) => {
          setName(next);
          if (nameError) {
            setNameError(null);
          }
          if (formError) {
            setFormError(null);
          }
        }}
        placeholder="Your full name"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        error={nameError}
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
        returnKeyType="next"
        error={emailError}
      />

      <AuthInputField
        label="Phone number"
        value={phoneInput}
        onChangeText={(next) => {
          setPhoneInput(formatIndianPhoneInput(next));
          if (phoneError) {
            setPhoneError(null);
          }
          if (formError) {
            setFormError(null);
          }
        }}
        placeholder="98765 43210"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        maxLength={11}
        returnKeyType="done"
        error={phoneError}
        prefix="+91"
      />

      {showReferralField || referralCode ? (
        <Animated.View
          style={[
            styles.referralReveal,
            {
              opacity: referralFadeAnim,
              transform: [
                {
                  translateY: referralFadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [6, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <AuthInputField
            label="Referral code"
            value={referralCode}
            onChangeText={(next) => {
              setReferralCode(next.toUpperCase());
            }}
            placeholder="DOFURS50"
            autoCapitalize="characters"
            returnKeyType="done"
          />

          <Pressable
            style={styles.referralCollapse}
            onPress={() => {
              setShowReferralField(false);
              if (!referralCode.trim()) {
                referralFadeAnim.setValue(0);
              }
            }}
          >
            <Text style={styles.referralCollapseLabel}>Hide referral code</Text>
          </Pressable>
        </Animated.View>
      ) : (
        <Pressable style={styles.referralToggle} onPress={revealReferralField}>
          <Text style={styles.referralToggleLabel}>Have a referral code? Add one</Text>
        </Pressable>
      )}

      {formError ? <AuthErrorMessage message={formError} /> : null}

      <AuthPrimaryButton
        label="Create account ->"
        loadingLabel="Sending OTP..."
        loading={loading}
        onPress={handleSendOtp}
      />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  referralToggle: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  referralToggleLabel: {
    color: '#6d4f39',
    fontSize: 13,
    fontWeight: '600',
  },
  referralReveal: {
    width: '100%',
  },
  referralCollapse: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  referralCollapseLabel: {
    color: '#8a7565',
    fontSize: 12,
    fontWeight: '500',
  },
});

