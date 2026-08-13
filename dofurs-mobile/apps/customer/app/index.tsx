import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ApiError,
  bootstrapProfile,
  dofursColors,
  getUserProfile,
  isCustomerAppRole,
  requiresProfileSetupFromError,
  Screen,
  signOutAndResetClientState,
  useAuthStore,
} from '@dofurs/shared';

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
        const canUseCustomerTabs = isCustomerAppRole(roleName ?? null);

        if (active) {
          if (canUseCustomerTabs) {
            setRequiresProfileSetup(false);
            router.replace('/(tabs)/home');
            return;
          }

          await signOutAndResetClientState();
          setRequiresProfileSetup(false);
          router.replace('/(auth)/sign-in');
        }
      } catch (error) {
        if (requiresProfileSetupFromError(error)) {
          if (active) {
            setRequiresProfileSetup(true);
            router.replace('/(auth)/complete-profile');
          }

          return;
        }

        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          if (active) {
            await signOutAndResetClientState();
            setRequiresProfileSetup(false);
            router.replace('/(auth)/sign-in');
          }

          return;
        }

        if (active) {
          setMessage('Could not reach Dofurs right now. Retrying shortly...');

          setTimeout(() => {
            if (!active) {
              return;
            }

            router.replace('/');
          }, 1200);
        }
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
