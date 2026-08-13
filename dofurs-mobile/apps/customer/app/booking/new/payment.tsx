import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Screen,
  dofursColors,
} from '@dofurs/shared';

export default function PlaceholderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    providerOrderId?: string;
    providerPaymentId?: string;
    providerSignature?: string;
  }>();

  useEffect(() => {
    router.replace({
      pathname: '/booking/new/summary',
      params: {
        providerOrderId: typeof params.providerOrderId === 'string' ? params.providerOrderId : undefined,
        providerPaymentId: typeof params.providerPaymentId === 'string' ? params.providerPaymentId : undefined,
        providerSignature: typeof params.providerSignature === 'string' ? params.providerSignature : undefined,
      },
    });
  }, [params.providerOrderId, params.providerPaymentId, params.providerSignature, router]);

  return (
    <Screen scroll>
      <Text style={styles.title}>Redirecting...</Text>
      <Text style={styles.meta}>Payment and confirmation are now part of Step 3.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: dofursColors.ink,
    fontSize: 24,
    fontWeight: '700',
  },
  meta: {
    color: '#6d635c',
    fontSize: 12,
  },
});
