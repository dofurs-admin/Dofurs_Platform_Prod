import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError, bootstrapProfile, dofursColors, getUserProfile, Screen, useAuthStore } from '@dofurs/shared';

export default function Index() {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const accessToken = useAuthStore((state) => state.accessToken);
  const setRole = useAuthStore((state) => state.setRole);
  const [message, setMessage] = useState('Preparing provider workspace...');

  useEffect(() => {
    async function runBootstrap() {
      if (status === 'idle' || status === 'loading') {
        return;
      }

      if (!accessToken) {
        router.replace('/(auth)/sign-in');
        return;
      }

      setMessage('Verifying provider access...');

      try {
        await bootstrapProfile();
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 409)) {
          router.replace('/(auth)/sign-in');
          return;
        }
      }

      try {
        const profileResult = await getUserProfile();
        const roleName = profileResult.profile?.roles?.name ?? null;
        setRole(roleName);

        if (roleName === 'provider' || roleName === 'admin' || roleName === 'staff') {
          router.replace('/(tabs)/home');
          return;
        }

        router.replace('/(auth)/apply');
      } catch {
        router.replace('/(auth)/sign-in');
      }
    }

    runBootstrap();
  }, [accessToken, router, setRole, status]);

  return (
    <Screen>
      <View style={styles.container}>
        <ActivityIndicator color={dofursColors.coral} size="large" />
        <Text style={styles.message}>{message}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  message: {
    color: '#5b544f',
    fontSize: 15,
  },
});
