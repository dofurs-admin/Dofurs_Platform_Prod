import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getSupabaseClient, queryClient, useAuthStore } from '@dofurs/shared';

function normalizeRole(value: unknown) {
  if (value === 'user' || value === 'provider' || value === 'admin' || value === 'staff') {
    return value;
  }

  return null;
}

export default function RootLayout() {
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setStatus = useAuthStore((state) => state.setStatus);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseClient();

    const applySession = (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
      if (!active) {
        return;
      }

      if (!session?.access_token || !session.user?.id) {
        clearSession();
        return;
      }

      const role = normalizeRole(
        session.user.user_metadata?.role ?? session.user.user_metadata?.app_role ?? null,
      );

      setSession({
        accessToken: session.access_token,
        userId: session.user.id,
        role,
      });
    };

    setStatus('loading');

    supabase.auth
      .getSession()
      .then(({ data }) => {
        applySession(data.session);
      })
      .catch(() => {
        if (active) {
          clearSession();
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [clearSession, setSession, setStatus]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
