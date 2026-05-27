'use client';

import dynamic from 'next/dynamic';
import { ToastProvider } from './ToastProvider';

const DevNetworkCursorLoader =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('./GlobalNetworkCursorLoader'), { ssr: false })
    : () => null;

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <DevNetworkCursorLoader />
      {children}
    </ToastProvider>
  );
}
