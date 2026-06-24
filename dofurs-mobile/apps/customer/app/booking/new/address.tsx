import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen, dofursColors, getOwnerAddresses } from '@dofurs/shared';

type AddressRow = {
  id: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
};

const DEFAULT_LATITUDE = 12.9716;
const DEFAULT_LONGITUDE = 77.5946;

export default function PlaceholderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    providerServiceId?: string;
    providerId?: string;
    petId?: string;
    bookingDate?: string;
    startTime?: string;
    bookingMode?: string;
  }>();

  const addressesQuery = useQuery({
    queryKey: ['customer', 'booking-flow', 'addresses'],
    queryFn: getOwnerAddresses,
  });

  const addresses = (addressesQuery.data?.addresses ?? []) as AddressRow[];
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState('Bengaluru, Karnataka');
  const [manualPincode, setManualPincode] = useState('560001');

  const bookingMode =
    params.bookingMode === 'clinic_visit' || params.bookingMode === 'teleconsult'
      ? params.bookingMode
      : 'home_visit';

  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  );

  const hasContext =
    typeof params.providerServiceId === 'string' &&
    typeof params.providerId === 'string' &&
    typeof params.petId === 'string' &&
    typeof params.bookingDate === 'string' &&
    typeof params.startTime === 'string';

  function handleContinue() {
    if (!hasContext) {
      return;
    }

    const fallbackAddress = manualAddress.trim();
    const addressLabel = selectedAddress
      ? [selectedAddress.address_line_1, selectedAddress.address_line_2, selectedAddress.city, selectedAddress.state]
          .filter((value): value is string => Boolean(value && value.trim().length > 0))
          .join(', ')
      : fallbackAddress;

    const latitude = selectedAddress?.latitude ?? DEFAULT_LATITUDE;
    const longitude = selectedAddress?.longitude ?? DEFAULT_LONGITUDE;
    const pincode = selectedAddress?.pincode ?? manualPincode.trim();

    router.push({
      pathname: '/booking/new/addons',
      params: {
        providerServiceId: params.providerServiceId,
        providerId: params.providerId,
        petId: params.petId,
        bookingDate: params.bookingDate,
        startTime: params.startTime,
        bookingMode,
        locationAddress: addressLabel,
        latitude: String(latitude),
        longitude: String(longitude),
        pincode,
      },
    });
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Select address</Text>
      <Text style={styles.subtitle}>Step 4 of 7</Text>

      {bookingMode === 'home_visit' ? (
        <Text style={styles.meta}>Home visit requires a service location.</Text>
      ) : (
        <Text style={styles.meta}>Address is optional for this booking mode.</Text>
      )}

      {addresses.map((address) => {
        const isSelected = selectedAddressId === address.id;
        return (
          <Pressable key={address.id} style={[styles.card, isSelected && styles.cardSelected]} onPress={() => setSelectedAddressId(address.id)}>
            <Text style={styles.cardTitle}>{address.address_line_1}</Text>
            {address.address_line_2 ? <Text style={styles.meta}>{address.address_line_2}</Text> : null}
            <Text style={styles.meta}>{address.city}, {address.state} {address.pincode}</Text>
          </Pressable>
        );
      })}

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Manual fallback</Text>
        <TextInput
          placeholder="Address line"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={manualAddress}
          onChangeText={setManualAddress}
        />
        <TextInput
          keyboardType="number-pad"
          placeholder="Pincode"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={manualPincode}
          onChangeText={setManualPincode}
        />
      </View>

      <Pressable style={[styles.primaryButton, !hasContext && styles.buttonDisabled]} onPress={handleContinue} disabled={!hasContext}>
        <Text style={styles.primaryButtonLabel}>Continue to add-ons</Text>
      </Pressable>
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
  meta: {
    color: '#6d635c',
    fontSize: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 12,
    gap: 4,
  },
  cardSelected: {
    borderColor: dofursColors.coral,
    backgroundColor: '#fff2e7',
  },
  cardTitle: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
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
    fontSize: 13,
    fontWeight: '700',
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
  primaryButton: {
    marginTop: 6,
    borderRadius: 10,
    backgroundColor: dofursColors.coral,
    alignItems: 'center',
    paddingVertical: 11,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
