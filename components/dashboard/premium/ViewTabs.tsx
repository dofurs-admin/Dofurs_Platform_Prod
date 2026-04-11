'use client';

import Link from 'next/link';

interface ViewTab {
  id: string;
  label: string;
  href: string;
  isActive: boolean;
}

interface ViewTabsProps {
  tabs: ViewTab[];
}

export default function ViewTabs({ tabs }: ViewTabsProps) {
  return (
    <div className="overflow-x-auto border-b border-neutral-200">
      <div className="flex min-w-max gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={`inline-flex items-center whitespace-nowrap px-4 py-3 text-sm font-semibold transition-all duration-150 ease-out border-b-2 ${
              tab.isActive
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
