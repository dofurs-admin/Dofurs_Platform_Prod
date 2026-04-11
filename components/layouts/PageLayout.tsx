/**
 * PageLayout
 * 
 * Standard page container with consistent spacing and structure.
 * Used for content pages, dashboards, and general app pages.
 */

'use client';

import { ReactNode } from 'react';

interface PageLayoutProps {
  children: ReactNode;
  maxWidth?: 'default' | 'narrow' | 'wide' | 'full';
  className?: string;
}

export default function PageLayout({ 
  children, 
  maxWidth = 'default',
  className = '' 
}: PageLayoutProps) {
  const widthClasses = {
    narrow: 'max-w-4xl',
    default: 'max-w-7xl',
    wide: 'max-w-[1400px]',
    full: 'max-w-none',
  };

  return (
    <div className={`mx-auto ${widthClasses[maxWidth]} px-4 sm:px-6 lg:px-8 py-8 lg:py-12 ${className}`}>
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`}>
      <div className="space-y-2">
        <h1 className="text-page-title">{title}</h1>
        {description && (
          <p className="text-body text-neutral-600 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3">
          {actions}
        </div>
      )}
    </div>
  );
}

interface PageSectionProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageSection({ title, description, actions, children, className = '' }: PageSectionProps) {
  return (
    <section className={`space-y-6 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {title && (
            <div className="space-y-1">
              <h2 className="text-section-title">{title}</h2>
              {description && (
                <p className="text-sm text-neutral-600">{description}</p>
              )}
            </div>
          )}
          {actions && (
            <div className="flex items-center gap-3">
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
