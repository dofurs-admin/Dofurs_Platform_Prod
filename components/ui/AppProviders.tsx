'use client';

import GlobalNetworkCursorLoader from './GlobalNetworkCursorLoader';
import { ToastProvider } from './ToastProvider';

const DevNetworkCursorLoader =
  process.env.NODE_ENV === 'development'
    ? GlobalNetworkCursorLoader
    : () => null;

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <DevNetworkCursorLoader />
      {children}
    </ToastProvider>
  );
}
