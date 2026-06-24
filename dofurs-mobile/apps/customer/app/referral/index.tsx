import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError, Screen, dofursColors, validateReferralCode } from '@dofurs/shared';

export default function PlaceholderScreen() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleValidateCode() {
    setError(null);
    setResult(null);

    if (code.trim().length < 3) {
      setError('Enter a referral code.');
      return;
    }

    setChecking(true);

    try {
      const response = await validateReferralCode(code.trim().toUpperCase());
      if (response.valid) {
        setResult('Referral code looks valid.');
      } else {
        setError(response.message ?? 'Referral code is not valid.');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { message?: string; error?: string } | null;
        setError(detail?.message ?? detail?.error ?? `Unable to validate code (${err.status}).`);
      } else {
        setError('Unable to validate code right now.');
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Referral code checker</Text>
        <Text style={styles.subtitle}>Validate referral codes before using them during signup.</Text>

        <TextInput
          autoCapitalize="characters"
          placeholder="Enter referral code"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={code}
          onChangeText={setCode}
        />

        <Pressable style={[styles.button, checking && styles.buttonDisabled]} onPress={handleValidateCode} disabled={checking}>
          <Text style={styles.buttonLabel}>{checking ? 'Checking...' : 'Validate code'}</Text>
        </Pressable>

        {result ? <Text style={styles.success}>{result}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 14,
    gap: 8,
  },
  title: {
    color: dofursColors.ink,
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: '#4f4b47',
    fontSize: 14,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    color: dofursColors.ink,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
  },
  button: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: dofursColors.coral,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  success: {
    color: '#0f7a44',
    fontSize: 13,
  },
  error: {
    color: dofursColors.error,
    fontSize: 13,
  },
});
