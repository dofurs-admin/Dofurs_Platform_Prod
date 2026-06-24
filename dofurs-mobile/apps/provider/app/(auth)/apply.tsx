import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError, dofursColors, submitProviderApplication } from '@dofurs/shared';
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

export default function ProviderApplyScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [state, setState] = useState('Karnataka');
  const [providerType, setProviderType] = useState('grooming');
  const [experience, setExperience] = useState('1');
  const [serviceAreas, setServiceAreas] = useState('Bengaluru');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const normalizedPhone = useMemo(() => normalizeIndianPhone(phone), [phone]);

  async function handleSubmit() {
    setError(null);

    if (fullName.trim().length < 2) {
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

    if (providerType.trim().length < 2) {
      setError('Enter provider type.');
      return;
    }

    setLoading(true);

    try {
      await submitProviderApplication({
        partner_category: 'individual',
        business_name: '',
        team_size: null,
        full_name: fullName.trim(),
        email: normalizedEmail,
        phone_number: normalizedPhone,
        city: city.trim(),
        state: state.trim(),
        provider_type: providerType.trim(),
        years_of_experience: Number.parseInt(experience, 10) || 0,
        service_modes: ['home_visit'],
        service_areas: serviceAreas.trim(),
        portfolio_url: '',
        motivation: '',
        website: '',
      });

      router.replace('/(auth)/application-status');
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to submit application (${err.status}).`);
      } else {
        setError('Unable to submit application right now.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Apply as a Dofurs Provider</Text>
        <Text style={styles.subtitle}>Submit your basic details and our team will review your profile.</Text>

        <TextInput
          autoCapitalize="words"
          placeholder="Full name"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
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
          placeholder="Provider type (for example grooming, veterinary)"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={providerType}
          onChangeText={setProviderType}
        />

        <TextInput
          keyboardType="number-pad"
          placeholder="Years of experience"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={experience}
          onChangeText={setExperience}
        />

        <TextInput
          placeholder="City"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={city}
          onChangeText={setCity}
        />

        <TextInput
          placeholder="State"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={state}
          onChangeText={setState}
        />

        <TextInput
          placeholder="Primary service areas"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={serviceAreas}
          onChangeText={setServiceAreas}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.buttonLabel}>{loading ? 'Submitting...' : 'Submit application'}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 24,
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
