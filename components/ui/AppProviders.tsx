'use client';

import { ToastProvider } from './ToastProvider';
import GlobalNetworkCursorLoader from './GlobalNetworkCursorLoader';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <GlobalNetworkCursorLoader />
      {children}
    </ToastProvider>
  );
}
