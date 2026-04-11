'use client';

import { ReactNode } from 'react';

interface PremiumCardProps {
  children: ReactNode;
  className?: string;
}

export default function PremiumCard({ children, className = '' }: PremiumCardProps) {
  return (
    <div
      className={`rounded-2xl border border-neutral-200/60 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-150 ease-out ${className}`}
    >
      {children}
    </div>
  );
}
