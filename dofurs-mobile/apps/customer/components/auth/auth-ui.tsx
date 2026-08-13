import {
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
  type TextInputProps,
} from 'react-native';
import { Screen, dofursColors } from '@dofurs/shared';

export const DOFURS_LOGO = require('../../assets/brand-logo.png');
export const AUTH_VISUAL_LOGIN = require('../../assets/auth-login-pet.webp');
export const AUTH_VISUAL_SIGNUP = require('../../assets/auth-signup-pet.webp');

export function useLockBodyScrollOnWeb() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);
}

type AuthScaffoldProps = PropsWithChildren<{
  heroTitle?: string;
  heroSubtitle?: string;
  showBrandTagline?: boolean;
  centered?: boolean;
  footer: ReactNode;
  heroVisual?: ImageSourcePropType;
  heroVisualAccessibilityLabel?: string;
}>;

export function AuthScaffold({
  heroTitle,
  heroSubtitle,
  showBrandTagline = true,
  centered = false,
  footer,
  heroVisual,
  heroVisualAccessibilityLabel = 'Pet care visual',
  children,
}: AuthScaffoldProps) {
  const heroAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    heroAnim.setValue(0);
    cardAnim.setValue(0);

    Animated.parallel([
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 260,
        delay: 50,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [cardAnim, heroAnim]);

  const heroTranslate = heroAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });

  const cardTranslate = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  return (
    <Screen>
      <View style={[styles.scaffoldRoot, centered ? styles.scaffoldRootCentered : null]}>
        <View style={styles.backgroundShape} />

        <Animated.View
          style={[
            styles.heroBlock,
            centered ? styles.heroBlockCentered : null,
            { opacity: heroAnim, transform: [{ translateY: heroTranslate }] },
          ]}
        >
          <View style={styles.brandBlock}>
            <Image source={DOFURS_LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Dofurs logo" />
            {showBrandTagline ? <Text style={styles.brandTagline}>Where Pets Come First</Text> : null}
          </View>

          {heroTitle || heroSubtitle ? (
            <View style={styles.heroCopyBlock}>
              {heroTitle ? <Text style={styles.heroTitle}>{heroTitle}</Text> : null}
              {heroSubtitle ? <Text style={styles.heroSubtitle}>{heroSubtitle}</Text> : null}
            </View>
          ) : null}

          {heroVisual ? (
            <View style={styles.heroVisualFrame}>
              <Image
                source={heroVisual}
                style={styles.heroVisualImage}
                resizeMode="cover"
                accessibilityLabel={heroVisualAccessibilityLabel}
              />
            </View>
          ) : null}
        </Animated.View>

        <Animated.View
          style={[
            styles.cardAndFooter,
            centered ? styles.cardAndFooterCentered : null,
            { opacity: cardAnim, transform: [{ translateY: cardTranslate }] },
          ]}
        >
          <View style={styles.card}>{children}</View>
          <View style={styles.footerWrap}>{footer}</View>
        </Animated.View>
      </View>
    </Screen>
  );
}

type AuthSectionHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
};

export function AuthSectionHeader({ eyebrow, title, subtitle }: AuthSectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

type AuthInputFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  error?: string | null;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  autoFocus?: boolean;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  editable?: boolean;
  prefix?: string;
  maxLength?: number;
};

export function AuthInputField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType,
  autoCapitalize = 'none',
  autoCorrect = false,
  autoComplete,
  textContentType,
  autoFocus,
  returnKeyType,
  onSubmitEditing,
  editable = true,
  prefix,
  maxLength,
}: AuthInputFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.inputShell,
          isFocused && styles.inputShellFocused,
          !editable && styles.inputShellDisabled,
          error ? styles.inputShellError : null,
        ]}
      >
        {prefix ? (
          <>
            <Text style={styles.inputPrefix}>{prefix}</Text>
            <View style={styles.inputPrefixDivider} />
          </>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#a39387"
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          autoComplete={autoComplete}
          textContentType={textContentType}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          maxLength={maxLength}
          style={styles.inputField}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </View>
      {error ? <Text style={styles.fieldError}>Error: {error}</Text> : null}
    </View>
  );
}

type AuthPrimaryButtonProps = {
  label: string;
  loadingLabel: string;
  loading: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export function AuthPrimaryButton({
  label,
  loadingLabel,
  loading,
  onPress,
  disabled = false,
}: AuthPrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.primaryButton,
        isDisabled && styles.primaryButtonDisabled,
        pressed && !isDisabled ? styles.primaryButtonPressed : null,
      ]}
    >
      {loading ? (
        <View style={styles.primaryButtonLoadingRow}>
          <ActivityIndicator color={dofursColors.white} size="small" />
          <Text style={styles.primaryButtonLabel}>{loadingLabel}</Text>
        </View>
      ) : (
        <Text style={styles.primaryButtonLabel}>{label}</Text>
      )}
    </Pressable>
  );
}

type AuthBottomSwitchProps = {
  prompt: string;
  actionLabel: string;
  onPress: () => void;
  disabled?: boolean;
};

export function AuthBottomSwitch({ prompt, actionLabel, onPress, disabled = false }: AuthBottomSwitchProps) {
  return (
    <View style={styles.bottomSwitchRow}>
      <Text style={styles.bottomSwitchPrompt}>{prompt}</Text>
      <Pressable onPress={onPress} disabled={disabled}>
        <Text style={[styles.bottomSwitchAction, disabled && styles.bottomSwitchActionDisabled]}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

type AuthSupportTextProps = {
  text: string;
};

export function AuthSupportText({ text }: AuthSupportTextProps) {
  return <Text style={styles.supportText}>{text}</Text>;
}

type AuthErrorMessageProps = {
  message: string;
};

export function AuthErrorMessage({ message }: AuthErrorMessageProps) {
  return <Text style={styles.errorMessage}>{message}</Text>;
}

type OtpBoxesInputProps = {
  value: string;
  onChangeValue: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
};

export function OtpBoxesInput({
  value,
  onChangeValue,
  error,
  disabled = false,
  autoFocus = true,
}: OtpBoxesInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!autoFocus || disabled) {
      return;
    }

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 180);

    return () => clearTimeout(timer);
  }, [autoFocus, disabled]);

  const digits = value.padEnd(6, ' ').slice(0, 6).split('');
  const activeIndex = Math.min(value.length, 5);

  return (
    <View style={styles.otpWrap}>
      <Pressable style={styles.otpVisualGrid} onPress={() => inputRef.current?.focus()} disabled={disabled}>
        {digits.map((digit, index) => {
          const isActive = isFocused && index === activeIndex;
          const hasDigit = digit.trim().length > 0;

          return (
            <View
              key={`otp-box-${index}`}
              style={[
                styles.otpBox,
                hasDigit && styles.otpBoxFilled,
                isActive && styles.otpBoxFocused,
                error ? styles.otpBoxError : null,
              ]}
            >
              <Text style={styles.otpBoxDigit}>{hasDigit ? digit : ''}</Text>
            </View>
          );
        })}
      </Pressable>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(next) => onChangeValue(next.replace(/\D+/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        returnKeyType="done"
        maxLength={6}
        editable={!disabled}
        style={styles.hiddenOtpInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        accessibilityLabel="OTP code"
      />

      {error ? <Text style={styles.fieldError}>Error: {error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scaffoldRoot: {
    flex: 1,
    justifyContent: 'flex-start',
    gap: 24,
  },
  scaffoldRootCentered: {
    justifyContent: 'flex-start',
    paddingTop: 18,
    gap: 12,
  },
  backgroundShape: {
    position: 'absolute',
    top: -42,
    right: -56,
    width: 186,
    height: 138,
    borderRadius: 56,
    backgroundColor: '#f4e3d5',
    opacity: 0.42,
    transform: [{ rotate: '-10deg' }],
    pointerEvents: 'none',
  },
  heroBlock: {
    gap: 16,
  },
  heroBlockCentered: {
    minHeight: 74,
    justifyContent: 'center',
  },
  brandBlock: {
    alignItems: 'center',
    gap: 6,
  },
  logo: {
    width: 198,
    height: 63,
  },
  brandTagline: {
    color: '#836b5b',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  heroCopyBlock: {
    gap: 6,
  },
  heroTitle: {
    color: '#221f1d',
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
    textAlign: 'center',
  },
  heroSubtitle: {
    color: '#6a5a4f',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  heroVisualFrame: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e9d8ca',
    backgroundColor: '#f6ebe1',
    minHeight: 128,
  },
  heroVisualImage: {
    width: '100%',
    height: 148,
  },
  cardAndFooter: {
    marginTop: 8,
    gap: 16,
  },
  cardAndFooterCentered: {
    flex: 1,
    justifyContent: 'center',
    marginTop: 0,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#eadbce',
    backgroundColor: '#fffaf6',
    padding: 22,
    gap: 16,
  },
  footerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24,
  },
  sectionHeader: {
    gap: 8,
  },
  sectionEyebrow: {
    color: '#9a6745',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.7,
  },
  sectionTitle: {
    color: '#201d1b',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  sectionSubtitle: {
    color: '#6c5a4f',
    fontSize: 13,
    lineHeight: 20,
  },
  fieldWrap: {
    gap: 8,
  },
  fieldLabel: {
    color: '#5f4a3b',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  inputShell: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dfd0c3',
    backgroundColor: '#fffdf9',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  inputShellFocused: {
    borderColor: dofursColors.coral,
    borderWidth: 1.5,
  },
  inputShellError: {
    borderColor: '#c56f61',
    backgroundColor: '#fff8f6',
  },
  inputShellDisabled: {
    opacity: 0.62,
  },
  inputPrefix: {
    color: '#594534',
    fontSize: 15,
    fontWeight: '600',
    marginRight: 8,
  },
  inputPrefixDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginRight: 10,
    backgroundColor: '#ecd7c3',
  },
  inputField: {
    flex: 1,
    color: '#1f1f1f',
    fontSize: 15,
    paddingVertical: 0,
  },
  fieldError: {
    color: '#b75649',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 13,
    backgroundColor: dofursColors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.99 }],
    backgroundColor: dofursColors.coralDeep,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButtonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  supportText: {
    color: '#7a6759',
    fontSize: 12,
    lineHeight: 18,
  },
  errorMessage: {
    color: '#b34c3e',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  bottomSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bottomSwitchPrompt: {
    color: '#716153',
    fontSize: 13,
  },
  bottomSwitchAction: {
    color: dofursColors.coralDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  bottomSwitchActionDisabled: {
    opacity: 0.65,
  },
  otpWrap: {
    gap: 8,
  },
  otpVisualGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  otpBox: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e3d0be',
    backgroundColor: '#fffdf9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: {
    borderColor: '#d5b89f',
  },
  otpBoxFocused: {
    borderColor: dofursColors.coral,
    shadowColor: dofursColors.coral,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  otpBoxError: {
    borderColor: '#c56f61',
    backgroundColor: '#fff8f6',
  },
  otpBoxDigit: {
    color: '#2a2421',
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 1,
  },
  hiddenOtpInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0.01,
  },
});
