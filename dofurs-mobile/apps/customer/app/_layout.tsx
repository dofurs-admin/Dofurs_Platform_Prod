import { useEffect, useRef } from 'react';
import { AppState, StyleSheet, View, type AppStateStatus } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  deriveAuthSessionLifecycleDecision,
  getSupabaseClient,
  queryClient,
  refreshSessionOnAppActive,
  useAuthStore,
} from '@dofurs/shared';
import { CustomerHeaderBar, CustomerShortcutBar } from '../components/ui/customer-app-chrome';

export default function RootLayout() {
  const segments = useSegments();
  const isAuthRoute = segments[0] === '(auth)';
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setStatus = useAuthStore((state) => state.setStatus);
  const previousUserIdRef = useRef<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseClient();

    const applySession = (
      session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'],
      options?: { allowClear?: boolean },
    ) => {
      if (!active) {
        return;
      }

      const decision = deriveAuthSessionLifecycleDecision(previousUserIdRef.current, session);

      if (decision.type === 'clear') {
        if (options?.allowClear === false) {
          return;
        }

        previousUserIdRef.current = null;
        queryClient.clear();
        clearSession();
        return;
      }

      if (decision.shouldClearQuery) {
        queryClient.clear();
      }

      previousUserIdRef.current = decision.nextPreviousUserId;

      setSession(decision.session);
    };

    setStatus('loading');

    supabase.auth
      .getSession()
      .then(({ data }) => {
        applySession(data.session);
      })
      .catch(() => {
        if (active) {
          const hasExistingSession = Boolean(useAuthStore.getState().accessToken);
          setStatus(hasExistingSession ? 'authenticated' : 'idle');
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignore non-sign-out null sessions to avoid involuntary sign-outs during dev reload races.
      if (!session && event !== 'SIGNED_OUT') {
        return;
      }

      applySession(session, { allowClear: event === 'SIGNED_OUT' || event === 'INITIAL_SESSION' });
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      void refreshSessionOnAppActive(previousState, nextState, {
        refreshSession: () => supabase.auth.refreshSession(),
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, [clearSession, setSession, setStatus]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <View style={styles.root}>
        {isAuthRoute ? null : <CustomerHeaderBar />}
        <View style={styles.stackWrap}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
        {isAuthRoute ? null : <CustomerShortcutBar />}
      </View>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff9f2',
  },
  stackWrap: {
    flex: 1,
    minHeight: 0,
  },
});
