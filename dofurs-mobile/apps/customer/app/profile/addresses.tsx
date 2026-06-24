import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  ApiError,
  Screen,
  createOwnerAddress,
  deleteOwnerAddress,
  dofursColors,
  getOwnerAddresses,
} from '@dofurs/shared';

type AddressRow = {
  id: string;
  label: string | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  is_default: boolean;
};

export default function PlaceholderScreen() {
  const addressesQuery = useQuery({
    queryKey: ['customer', 'addresses'],
    queryFn: getOwnerAddresses,
  });

  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [state, setState] = useState('Karnataka');
  const [pincode, setPincode] = useState('560001');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const addresses = (addressesQuery.data?.addresses ?? []) as AddressRow[];

  async function handleAddAddress() {
    setError(null);

    if (addressLine1.trim().length < 3) {
      setError('Enter a valid address line.');
      return;
    }

    if (!/^[1-9]\d{5}$/.test(pincode.trim())) {
      setError('Enter a valid 6-digit Indian pincode.');
      return;
    }

    setSubmitting(true);

    try {
      await createOwnerAddress({
        label: 'Home',
        address_line_1: addressLine1.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        country: 'India',
        is_default: addresses.length === 0,
      });

      setAddressLine1('');
      await addressesQuery.refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to add address (${err.status}).`);
      } else {
        setError('Unable to add address right now.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteAddress(id: string) {
    setError(null);

    try {
      await deleteOwnerAddress(id);
      await addressesQuery.refetch();
    } catch {
      setError('Unable to delete address right now.');
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Saved addresses</Text>
      <Text style={styles.subtitle}>Choose and manage service locations for home visits.</Text>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Add new address</Text>
        <TextInput
          placeholder="Address line 1"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={addressLine1}
          onChangeText={setAddressLine1}
        />
        <TextInput placeholder="City" placeholderTextColor="#9b8f87" style={styles.input} value={city} onChangeText={setCity} />
        <TextInput placeholder="State" placeholderTextColor="#9b8f87" style={styles.input} value={state} onChangeText={setState} />
        <TextInput
          keyboardType="number-pad"
          placeholder="Pincode"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={pincode}
          onChangeText={setPincode}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.primaryButton, submitting && styles.disabled]} onPress={handleAddAddress} disabled={submitting}>
          <Text style={styles.primaryButtonLabel}>{submitting ? 'Saving...' : 'Save address'}</Text>
        </Pressable>
      </View>

      {addressesQuery.isLoading ? <Text style={styles.meta}>Loading addresses...</Text> : null}

      {addresses.map((address) => (
        <View key={address.id} style={styles.card}>
          <Text style={styles.cardTitle}>{address.label ?? 'Address'}</Text>
          <Text style={styles.meta}>{address.address_line_1}</Text>
          {address.address_line_2 ? <Text style={styles.meta}>{address.address_line_2}</Text> : null}
          <Text style={styles.meta}>{address.city}, {address.state} {address.pincode}</Text>
          <Text style={styles.meta}>{address.country}</Text>

          <Pressable style={styles.deleteButton} onPress={() => handleDeleteAddress(address.id)}>
            <Text style={styles.deleteButtonLabel}>Delete</Text>
          </Pressable>
        </View>
      ))}

      {!addressesQuery.isLoading && addresses.length === 0 ? (
        <Text style={styles.meta}>No addresses added yet.</Text>
      ) : null}
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
    marginTop: 4,
    color: '#4f4b47',
    fontSize: 14,
  },
  formCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    color: dofursColors.ink,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
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
  disabled: {
    opacity: 0.7,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 12,
    gap: 4,
  },
  cardTitle: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    color: '#6d635c',
    fontSize: 12,
  },
  deleteButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  deleteButtonLabel: {
    color: '#8a3d2c',
    fontSize: 12,
    fontWeight: '700',
  },
  error: {
    color: dofursColors.error,
    fontSize: 12,
  },
});
