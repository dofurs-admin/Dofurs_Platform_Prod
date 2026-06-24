import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ApiError,
  Screen,
  dofursColors,
  getOwnerProfile,
  getUserProfile,
  patchOwnerProfile,
  patchUserProfile,
} from '@dofurs/shared';

type GenderOption = 'male' | 'female' | 'other';

export default function PlaceholderScreen() {
  const router = useRouter();

  const userProfileQuery = useQuery({
    queryKey: ['customer', 'profile', 'edit', 'user'],
    queryFn: getUserProfile,
  });

  const ownerProfileQuery = useQuery({
    queryKey: ['customer', 'profile', 'edit', 'owner'],
    queryFn: getOwnerProfile,
  });

  const userProfile = userProfileQuery.data?.profile as Record<string, unknown> | undefined;
  const ownerProfile = ownerProfileQuery.data?.profile as Record<string, unknown> | undefined;

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('Bengaluru, Karnataka');
  const [age, setAge] = useState('25');
  const [gender, setGender] = useState<GenderOption>('other');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [firstPetOwner, setFirstPetOwner] = useState(false);
  const [yearsOfPetExperience, setYearsOfPetExperience] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const derivedGender = useMemo<GenderOption>(() => {
    const raw = typeof userProfile?.gender === 'string' ? userProfile.gender : '';
    if (raw === 'male' || raw === 'female' || raw === 'other') {
      return raw;
    }
    return 'other';
  }, [userProfile?.gender]);

  if (!initialized && (userProfile || ownerProfile)) {
    setFullName(typeof userProfile?.name === 'string' ? userProfile.name : (typeof ownerProfile?.full_name === 'string' ? ownerProfile.full_name : ''));
    setPhone(typeof userProfile?.phone === 'string' ? userProfile.phone : (typeof ownerProfile?.phone_number === 'string' ? ownerProfile.phone_number : ''));
    setAddress(typeof userProfile?.address === 'string' ? userProfile.address : 'Bengaluru, Karnataka');
    setAge(typeof userProfile?.age === 'number' ? String(userProfile.age) : '25');
    setGender(derivedGender);
    setDateOfBirth(typeof ownerProfile?.date_of_birth === 'string' ? ownerProfile.date_of_birth.slice(0, 10) : '');
    setFirstPetOwner(Boolean(ownerProfile?.first_pet_owner));
    setYearsOfPetExperience(
      typeof ownerProfile?.years_of_pet_experience === 'number' ? String(ownerProfile.years_of_pet_experience) : '',
    );
    setInitialized(true);
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);

    if (fullName.trim().length < 2) {
      setError('Name should have at least 2 characters.');
      return;
    }

    if (!/^\+[1-9]\d{6,14}$/.test(phone.trim())) {
      setError('Phone should be in international format, for example +91XXXXXXXXXX.');
      return;
    }

    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge < 13 || parsedAge > 120) {
      setError('Age should be between 13 and 120.');
      return;
    }

    setSubmitting(true);

    try {
      await patchUserProfile({
        name: fullName.trim(),
        phone: phone.trim(),
        address: address.trim() || 'Bengaluru, Karnataka',
        age: parsedAge,
        gender,
      });

      await patchOwnerProfile({
        basic: {
          full_name: fullName.trim(),
          phone_number: phone.trim(),
          date_of_birth: dateOfBirth.trim() || null,
          gender,
        },
        household: {
          first_pet_owner: firstPetOwner,
          years_of_pet_experience: yearsOfPetExperience.trim() ? Number(yearsOfPetExperience) : null,
        },
      });

      setSuccess('Profile updated successfully.');
      await Promise.all([userProfileQuery.refetch(), ownerProfileQuery.refetch()]);
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
      <Text style={styles.title}>Edit profile</Text>
      <Text style={styles.subtitle}>Keep personal and household preferences up to date.</Text>

      <View style={styles.card}>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
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
          value={address}
          onChangeText={setAddress}
          placeholder="Address"
          placeholderTextColor="#9b8f87"
        />

        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={age}
          onChangeText={setAge}
          placeholder="Age"
          placeholderTextColor="#9b8f87"
        />

        <View style={styles.row}>
          {(['male', 'female', 'other'] as GenderOption[]).map((option) => {
            const selected = gender === option;
            return (
              <Pressable key={option} style={[styles.chip, selected && styles.chipSelected]} onPress={() => setGender(option)}>
                <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          style={styles.input}
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          placeholder="Date of birth YYYY-MM-DD"
          placeholderTextColor="#9b8f87"
        />

        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={yearsOfPetExperience}
          onChangeText={setYearsOfPetExperience}
          placeholder="Years of pet experience"
          placeholderTextColor="#9b8f87"
        />

        <Pressable style={[styles.chip, firstPetOwner && styles.chipSelected]} onPress={() => setFirstPetOwner((value) => !value)}>
          <Text style={[styles.chipLabel, firstPetOwner && styles.chipLabelSelected]}>
            {firstPetOwner ? 'First-time pet owner' : 'Experienced pet owner'}
          </Text>
        </Pressable>

        <Pressable style={[styles.primaryButton, submitting && styles.buttonDisabled]} onPress={handleSave} disabled={submitting}>
          <Text style={styles.primaryButtonLabel}>{submitting ? 'Saving...' : 'Save profile'}</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonLabel}>Back</Text>
        </Pressable>

        {userProfileQuery.isLoading || ownerProfileQuery.isLoading ? <Text style={styles.meta}>Loading profile...</Text> : null}
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipSelected: {
    borderColor: dofursColors.coral,
    backgroundColor: '#fff2e7',
  },
  chipLabel: {
    color: '#5d5853',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  chipLabelSelected: {
    color: dofursColors.ink,
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
