/**
 * SettingsLayout
 * 
 * Two-column layout for settings pages.
 * Left: Navigation sidebar
 * Right: Settings content
 */

'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SettingsSection {
  id: string;
  title: string;
  href: string;
  icon?: string;
}

interface SettingsLayoutProps {
  sections: SettingsSection[];
  children: ReactNode;
  title?: string;
  description?: string;
}

export default function SettingsLayout({ 
  sections, 
  children, 
  title = 'Settings',
  description = 'Manage your account settings and preferences'
}: SettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="container-premium py-8 lg:py-12">
      {/* Header */}
      <div className="mb-8 space-y-2">
        <h1 className="text-page-title">{title}</h1>
        {description && (
          <p className="text-body text-neutral-600">{description}</p>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
        {/* Left Sidebar - Navigation */}
        <aside className="space-y-1">
          <nav className="space-y-1">
            {sections.map((section) => {
              const isActive = pathname === section.href || pathname.startsWith(section.href + '/');
              
              return (
                <Link
                  key={section.id}
                  href={section.href}
                  className={`
                    flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ease-out
                    ${isActive 
                      ? 'bg-coral text-white' 
                      : 'text-neutral-700 hover:bg-neutral-100'
                    }
                  `}
                >
                  {section.icon && <span className="text-base">{section.icon}</span>}
                  {section.title}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Right Content Area */}
        <main className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

interface SettingsCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function SettingsCard({ title, description, children, className = '' }: SettingsCardProps) {
  return (
    <div className={`card card-padding space-y-6 ${className}`}>
      <div className="space-y-1 border-b border-neutral-200/60 pb-4">
        <h3 className="text-card-title">{title}</h3>
        {description && (
          <p className="text-sm text-neutral-600">{description}</p>
        )}
      </div>
      <div className="space-y-5">
        {children}
      </div>
    </div>
  );
}

interface SettingsGroupProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function SettingsGroup({ title, description, children }: SettingsGroupProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-neutral-900">{title}</h4>
        {description && (
          <p className="text-xs text-neutral-500">{description}</p>
        )}
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}
