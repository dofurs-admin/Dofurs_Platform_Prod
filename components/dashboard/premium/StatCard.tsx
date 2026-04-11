'use client';

import { cn } from '@/lib/design-system';
import {
  AlertCircle,
  Award,
  Calendar,
  Tag,
  TrendingUp,
  Users,
  X,
  XCircle,
  Star,
  type LucideIcon,
} from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  description?: string;
  icon?: string;
  className?: string;
  highlight?: boolean;
}

export default function StatCard({ 
  label, 
  value, 
  trend, 
  trendValue,
  description, 
  icon,
  className,
  highlight = false,
}: StatCardProps) {
  const trendColors = {
    up: 'text-emerald-600',
    down: 'text-red-600',
    neutral: 'text-neutral-400',
  };

  const trendIcons = {
    up: '↑',
    down: '↓',
    neutral: '−',
  };

  const iconMap: Record<string, LucideIcon> = {
    calendar: Calendar,
    'alert-circle': AlertCircle,
    'x-circle': XCircle,
    x: X,
    users: Users,
    tag: Tag,
    star: Star,
    'trending-up': TrendingUp,
    award: Award,
  };

  const IconComponent = icon ? iconMap[icon] : undefined;

  return (
    <div className={cn(
      'card card-interactive space-y-2.5 p-3 sm:space-y-4 sm:p-6',
      highlight && 'border-brand-300 bg-[linear-gradient(180deg,#fff8f0_0%,#fff2e4_100%)] ring-1 ring-brand-200/50',
      className,
    )}>
      {/* Header with label and trend */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {IconComponent ? <IconComponent size={14} className="text-neutral-500 sm:h-4 sm:w-4" /> : null}
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 sm:text-xs">
            {label}
          </p>
        </div>
        {trend && (
          <div className={cn('flex items-center gap-1 text-xs font-semibold sm:text-sm', trendColors[trend])}>
            <span>{trendIcons[trend]}</span>
            {trendValue && <span>{trendValue}</span>}
          </div>
        )}
      </div>

      {/* Value - large and prominent */}
      <p className="text-2xl font-bold text-neutral-950 sm:text-3xl">{value}</p>

      {/* Optional description */}
      {description && (
        <p className="text-xs text-neutral-500">{description}</p>
      )}
    </div>
  );
}
