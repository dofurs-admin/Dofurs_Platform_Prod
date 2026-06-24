import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ApiError,
  Screen,
  dofursColors,
  getProviderDashboard,
  patchProviderProfile,
} from '@dofurs/shared';

export default function PlaceholderScreen() {
  const router = useRouter();

  const dashboardQuery = useQuery({
    queryKey: ['provider', 'dashboard', 'edit-profile'],
    queryFn: getProviderDashboard,
  });

  const provider = useMemo(() => {
    const dashboard = dashboardQuery.data?.dashboard as Record<string, unknown> | null | undefined;
    return (dashboard?.provider as Record<string, unknown> | undefined) ?? null;
  }, [dashboardQuery.data?.dashboard]);

  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [serviceRadiusKm, setServiceRadiusKm] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!initialized && provider) {
    setBio(typeof provider.bio === 'string' ? provider.bio : '');
    setPhone(typeof provider.phone_number === 'string' ? provider.phone_number : '');
    setEmail(typeof provider.email === 'string' ? provider.email : '');
    setYearsOfExperience(
      typeof provider.years_of_experience === 'number' ? String(provider.years_of_experience) : '',
    );
    setServiceRadiusKm(
      typeof provider.service_radius_km === 'number' ? String(provider.service_radius_km) : '',
    );
    setInitialized(true);
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      await patchProviderProfile({
        bio: bio.trim() || null,
        phone_number: phone.trim() || null,
        email: email.trim() || null,
        years_of_experience: yearsOfExperience.trim() ? Number(yearsOfExperience) : null,
        service_radius_km: serviceRadiusKm.trim() ? Number(serviceRadiusKm) : null,
      });

      setSuccess('Profile updated.');
      await dashboardQuery.refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to update profile (${err.status}).`);
      } else {
        setError('Unable to update profile right now.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Edit provider profile</Text>
      <Text style={styles.subtitle}>Update customer-visible details and contact information.</Text>

      <View style={styles.card}>
        <TextInput
          multiline
          numberOfLines={5}
          style={styles.textArea}
          value={bio}
          onChangeText={setBio}
          placeholder="Professional bio"
          placeholderTextColor="#9b8f87"
        />

        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Phone (+91...)"
          placeholderTextColor="#9b8f87"
        />

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="#9b8f87"
        />

        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={yearsOfExperience}
          onChangeText={setYearsOfExperience}
          placeholder="Years of experience"
          placeholderTextColor="#9b8f87"
        />

        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={serviceRadiusKm}
          onChangeText={setServiceRadiusKm}
          placeholder="Service radius (km)"
          placeholderTextColor="#9b8f87"
        />

        <Pressable style={[styles.primaryButton, submitting && styles.buttonDisabled]} onPress={handleSave} disabled={submitting}>
          <Text style={styles.primaryButtonLabel}>{submitting ? 'Saving...' : 'Save changes'}</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonLabel}>Back</Text>
        </Pressable>

        {dashboardQuery.isLoading ? <Text style={styles.meta}>Loading profile...</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: dofursColors.ink,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#5d5853',
    fontSize: 13,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 12,
    gap: 8,
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
  textArea: {
    minHeight: 110,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    color: dofursColors.ink,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: dofursColors.coral,
    alignItems: 'center',
    paddingVertical: 10,
  },
  primaryButtonLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  meta: {
    color: '#6d635c',
    fontSize: 12,
  },
  error: {
    color: dofursColors.error,
    fontSize: 13,
  },
  success: {
    color: '#0f7a44',
    fontSize: 13,
  },
});
