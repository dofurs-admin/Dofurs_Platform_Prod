import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Screen,
  dofursColors,
} from '@dofurs/shared';

export default function PlaceholderScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/booking/new/datetime');
  }, [router]);

  return (
    <Screen scroll>
      <Text style={styles.title}>Redirecting...</Text>
      <Text style={styles.meta}>Address selection is now part of Step 2.</Text>
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