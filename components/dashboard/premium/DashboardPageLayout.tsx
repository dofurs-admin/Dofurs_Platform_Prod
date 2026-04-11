'use client';

import { ReactNode } from 'react';
import ViewTabs from './ViewTabs';

interface DashboardPageLayoutProps {
  title: string;
  description?: string;
  tabs: Array<{
    id: string;
    label: string;
    href: string;
  }>;
  activeTab: string;
  children: ReactNode;
}

export default function DashboardPageLayout({
  title,
  description,
  tabs,
  activeTab,
  children,
}: DashboardPageLayoutProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-950">{title}</h1>
        {description && <p className="mt-2 text-base text-neutral-600">{description}</p>}
      </div>

      {/* Tabs */}
      <ViewTabs
        tabs={tabs.map((tab) => ({
          ...tab,
          isActive: activeTab === tab.id,
        }))}
      />

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
