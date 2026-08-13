import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ApiError,
  bootstrapProfile,
  dofursColors,
  getUserProfile,
  resolveProviderAppRoute,
  Screen,
  signOutAndResetClientState,
  useAuthStore,
} from '@dofurs/shared';

export default function Index() {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const accessToken = useAuthStore((state) => state.accessToken);
  const setRole = useAuthStore((state) => state.setRole);
  const [message, setMessage] = useState('Preparing provider workspace...');

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

      setMessage('Verifying provider access...');

      try {
        await bootstrapProfile();
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          // Continue to profile fetch to complete onboarding route decision.
        } else {
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            if (active) {
              await signOutAndResetClientState();
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

          return;
        }
      }

      try {
        const profileResult = await getUserProfile();
        const roleName = profileResult.profile?.roles?.name ?? null;
        setRole(roleName);

        const route = resolveProviderAppRoute(roleName);

        if (route === '/(auth)/sign-in') {
          await signOutAndResetClientState();
        }

        if (active) {
          router.replace(route);
        }
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          if (active) {
            await signOutAndResetClientState();
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
