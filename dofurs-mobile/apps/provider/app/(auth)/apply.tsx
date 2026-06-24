import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ApiError,
  AuthScreenShell,
  authFormStyles,
  submitProviderApplication,
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
      setError('Enter a valid Indian phone number.');
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
    <AuthScreenShell
      badge="Dofurs"
      title="Doorstep Pet Grooming, From Verified Groomers Across Bengaluru"
      subtitle="Trusted by 100+ pet parents. Compare grooming packages, check inclusions, and book a verified groomer for a home visit."
      highlights={['Doorstep grooming', 'Background-verified', 'Pet-safe products']}
    >
      <Text style={authFormStyles.sectionEyebrow}>Application form</Text>
      <Text style={authFormStyles.sectionTitle}>Provider details</Text>
      <Text style={authFormStyles.sectionSubtitle}>Complete all required fields to submit your onboarding request.</Text>

      <View style={authFormStyles.fieldGroup}>
        <Text style={authFormStyles.fieldLabel}>Full name</Text>
        <TextInput
          autoCapitalize="words"
          placeholder="Full name"
          placeholderTextColor="#9b8f87"
          style={authFormStyles.input}
          value={fullName}
          onChangeText={setFullName}
        />
      </View>

      <View style={authFormStyles.fieldGroup}>
        <Text style={authFormStyles.fieldLabel}>Email</Text>
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
        <Text style={authFormStyles.fieldLabel}>Provider type</Text>
        <TextInput
          placeholder="grooming, veterinary, training"
          placeholderTextColor="#9b8f87"
          style={authFormStyles.input}
          value={providerType}
          onChangeText={setProviderType}
        />
      </View>

      <View style={authFormStyles.fieldGroup}>
        <Text style={authFormStyles.fieldLabel}>Years of experience</Text>
        <TextInput
          keyboardType="number-pad"
          placeholder="1"
          placeholderTextColor="#9b8f87"
          style={authFormStyles.input}
          value={experience}
          onChangeText={setExperience}
        />
      </View>

      <View style={authFormStyles.fieldGroup}>
        <Text style={authFormStyles.fieldLabel}>City</Text>
        <TextInput
          placeholder="City"
          placeholderTextColor="#9b8f87"
          style={authFormStyles.input}
          value={city}
          onChangeText={setCity}
        />
      </View>

      <View style={authFormStyles.fieldGroup}>
        <Text style={authFormStyles.fieldLabel}>State</Text>
        <TextInput
          placeholder="State"
          placeholderTextColor="#9b8f87"
          style={authFormStyles.input}
          value={state}
          onChangeText={setState}
        />
      </View>

      <View style={authFormStyles.fieldGroup}>
        <Text style={authFormStyles.fieldLabel}>Service areas</Text>
        <TextInput
          placeholder="Primary service areas"
          placeholderTextColor="#9b8f87"
          style={authFormStyles.input}
          value={serviceAreas}
          onChangeText={setServiceAreas}
        />
      </View>

      {error ? <Text style={authFormStyles.errorText}>{error}</Text> : null}

      <Pressable
        style={[authFormStyles.primaryButton, loading && authFormStyles.primaryButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={authFormStyles.primaryButtonLabel}>{loading ? 'Submitting...' : 'Submit application'}</Text>
      </Pressable>
    </AuthScreenShell>
  );
}

