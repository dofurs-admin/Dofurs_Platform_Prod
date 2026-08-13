import type { AppStateStatus } from 'react-native';

type AppStateRefreshCallbacks = {
  refreshSession: () => Promise<unknown>;
};

export async function refreshSessionOnAppActive(
  previousStatus: AppStateStatus,
  nextStatus: AppStateStatus,
  callbacks: AppStateRefreshCallbacks,
) {
  const wasBackgrounded = previousStatus === 'background' || previousStatus === 'inactive';
  const becameActive = nextStatus === 'active';

  if (!wasBackgrounded || !becameActive) {
    return;
  }

  await callbacks.refreshSession().catch(() => null);
}