'use client';

import { ToastProvider } from './ToastProvider';
import InactivitySessionManager from './InactivitySessionManager';
import GlobalNetworkCursorLoader from './GlobalNetworkCursorLoader';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <GlobalNetworkCursorLoader />
      <InactivitySessionManager />
      {children}
    </ToastProvider>
  );
}
