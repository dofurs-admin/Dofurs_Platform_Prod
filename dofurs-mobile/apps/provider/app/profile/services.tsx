import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ApiError,
  Screen,
  dofursColors,
  getProviderDashboard,
  patchProviderDetails,
} from '@dofurs/shared';

export default function PlaceholderScreen() {
  const router = useRouter();

  const dashboardQuery = useQuery({
    queryKey: ['provider', 'dashboard', 'services-profile'],
    queryFn: getProviderDashboard,
  });

  const professionalDetails = useMemo(() => {
    const dashboard = dashboardQuery.data?.dashboard as Record<string, unknown> | null | undefined;
    return (dashboard?.professionalDetails as Record<string, unknown> | undefined) ?? null;
  }, [dashboardQuery.data?.dashboard]);

  const clinicDetails = useMemo(() => {
    const dashboard = dashboardQuery.data?.dashboard as Record<string, unknown> | null | undefined;
    return (dashboard?.clinicDetails as Record<string, unknown> | undefined) ?? null;
  }, [dashboardQuery.data?.dashboard]);

  const [licenseNumber, setLicenseNumber] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [operatingHours, setOperatingHours] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!initialized && (professionalDetails || clinicDetails)) {
    setLicenseNumber(typeof professionalDetails?.license_number === 'string' ? professionalDetails.license_number : '');
    setSpecialization(typeof professionalDetails?.specialization === 'string' ? professionalDetails.specialization : '');
    setCity(typeof clinicDetails?.city === 'string' ? clinicDetails.city : '');
    setState(typeof clinicDetails?.state === 'string' ? clinicDetails.state : '');
    setPincode(typeof clinicDetails?.pincode === 'string' ? clinicDetails.pincode : '');
    setOperatingHours(typeof clinicDetails?.operating_hours === 'object' && clinicDetails.operating_hours ? JSON.stringify(clinicDetails.operating_hours) : '{}');
    setInitialized(true);
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    let parsedOperatingHours: Record<string, unknown> = {};
    try {
      parsedOperatingHours = operatingHours.trim() ? (JSON.parse(operatingHours) as Record<string, unknown>) : {};
    } catch {
      setSubmitting(false);
      setError('Operating hours must be valid JSON.');
      return;
    }

    try {
      await patchProviderDetails({
        professionalDetails: {
          license_number: licenseNumber.trim() || null,
          specialization: specialization.trim() || null,
        },
        clinicDetails: {
          city: city.trim() || null,
          state: state.trim() || null,
          pincode: pincode.trim() || null,
          operating_hours: parsedOperatingHours,
        },
      });

      setSuccess('Professional and clinic details updated.');
      await dashboardQuery.refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to update details (${err.status}).`);
      } else {
        setError('Unable to update details right now.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Service details</Text>
      <Text style={styles.subtitle}>Maintain provider credentials and clinic metadata.</Text>

      <View style={styles.card}>
        <TextInput
          style={styles.input}
          value={licenseNumber}
          onChangeText={setLicenseNumber}
          placeholder="License number"
          placeholderTextColor="#9b8f87"
        />

        <TextInput
          style={styles.input}
          value={specialization}
          onChangeText={setSpecialization}
          placeholder="Specialization"
          placeholderTextColor="#9b8f87"
        />

        <TextInput
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholder="City"
          placeholderTextColor="#9b8f87"
        />

        <TextInput
          style={styles.input}
          value={state}
          onChangeText={setState}
          placeholder="State"
          placeholderTextColor="#9b8f87"
        />

        <TextInput
          style={styles.input}
          value={pincode}
          onChangeText={setPincode}
          placeholder="Pincode"
          placeholderTextColor="#9b8f87"
        />

        <TextInput
          multiline
          numberOfLines={4}
          style={styles.textArea}
          value={operatingHours}
          onChangeText={setOperatingHours}
          placeholder='Operating hours JSON, for example {"mon":"9-18"}'
          placeholderTextColor="#9b8f87"
        />

        <Pressable style={[styles.primaryButton, submitting && styles.buttonDisabled]} onPress={handleSave} disabled={submitting}>
          <Text style={styles.primaryButtonLabel}>{submitting ? 'Saving...' : 'Save details'}</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonLabel}>Back</Text>
        </Pressable>

        {dashboardQuery.isLoading ? <Text style={styles.meta}>Loading details...</Text> : null}
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
    minHeight: 100,
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
