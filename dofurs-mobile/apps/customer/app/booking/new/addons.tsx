import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, dofursColors } from '@dofurs/shared';

export default function PlaceholderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    providerServiceId?: string;
    providerId?: string;
    petId?: string;
    bookingDate?: string;
    startTime?: string;
    bookingMode?: string;
    locationAddress?: string;
    latitude?: string;
    longitude?: string;
    pincode?: string;
  }>();

  const [discountCode, setDiscountCode] = useState('');
  const [providerNotes, setProviderNotes] = useState('');
  const [walletCredits, setWalletCredits] = useState('0');

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

    router.push({
      pathname: '/booking/new/summary',
      params: {
        ...params,
        discountCode: discountCode.trim(),
        providerNotes: providerNotes.trim(),
        walletCreditsAppliedInr: walletCredits.trim() || '0',
      },
    });
  }

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Add-ons and preferences</Text>
        <Text style={styles.subtitle}>Step 5 of 7</Text>

        <TextInput
          autoCapitalize="characters"
          placeholder="Discount code (optional)"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={discountCode}
          onChangeText={setDiscountCode}
        />

        <TextInput
          keyboardType="number-pad"
          placeholder="Wallet credits to apply (INR)"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={walletCredits}
          onChangeText={setWalletCredits}
        />

        <TextInput
          multiline
          numberOfLines={4}
          placeholder="Notes for provider (optional)"
          placeholderTextColor="#9b8f87"
          style={styles.textArea}
          value={providerNotes}
          onChangeText={setProviderNotes}
        />

        <Pressable style={[styles.primaryButton, !hasContext && styles.buttonDisabled]} onPress={handleContinue} disabled={!hasContext}>
          <Text style={styles.primaryButtonLabel}>Continue to summary</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 12,
    gap: 8,
  },
  title: {
    color: dofursColors.ink,
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#5d5853',
    fontSize: 13,
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
    minHeight: 90,
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
