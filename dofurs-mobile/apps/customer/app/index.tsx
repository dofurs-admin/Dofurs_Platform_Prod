import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError, bootstrapProfile, dofursColors, getUserProfile, Screen, useAuthStore } from '@dofurs/shared';

export default function Index() {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const accessToken = useAuthStore((state) => state.accessToken);
  const setRole = useAuthStore((state) => state.setRole);
  const setRequiresProfileSetup = useAuthStore((state) => state.setRequiresProfileSetup);
  const [message, setMessage] = useState('Preparing your account...');

  useEffect(() => {
    let active = true;

    async function runBootstrap() {
      if (status === 'idle' || status === 'loading') {
        return;
      }

      if (!accessToken) {
        router.replace('/(auth)/sign-in');
        return;
      }

      setMessage('Checking your profile...');

      try {
        await bootstrapProfile();
        const profileResult = await getUserProfile();
        const roleName = profileResult.profile?.roles?.name;
        setRole(roleName ?? null);
        setRequiresProfileSetup(false);

        if (active) {
          router.replace('/(tabs)/home');
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          const requiresProfileSetup =
            typeof error.details === 'object' &&
            error.details !== null &&
            'requiresProfileSetup' in error.details &&
            Boolean((error.details as { requiresProfileSetup?: unknown }).requiresProfileSetup);

          if (requiresProfileSetup) {
            setRequiresProfileSetup(true);
            router.replace('/(auth)/complete-profile');
            return;
          }
        }

        setRequiresProfileSetup(false);
        router.replace('/(tabs)/home');
      }
    }

    runBootstrap();

    return () => {
      active = false;
    };
  }, [accessToken, router, setRequiresProfileSetup, setRole, status]);

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
