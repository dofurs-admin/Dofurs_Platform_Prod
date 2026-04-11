/**
 * Dofurs Premium Design System
 * 
 * Unified design tokens for consistent UI/UX across the application.
 * Inspired by Stripe, Linear, Vercel, and modern startup dashboards.
 */

export const designSystem = {
  // Typography Scale
  typography: {
    display: 'text-display',
    pageTitle: 'text-page-title',
    sectionTitle: 'text-section-title',
    cardTitle: 'text-card-title',
    body: 'text-body',
    muted: 'text-muted',
  },

  // Spacing System (in px and Tailwind classes)
  spacing: {
    micro: 'space-y-2', // 8px
    small: 'space-y-4', // 16px
    medium: 'space-y-6', // 24px
    large: 'space-y-8', // 32px
    xlarge: 'space-y-12', // 48px
    
    // Grid gaps
    gridGap: 'gap-4', // 16px
    gridGapLarge: 'gap-6', // 24px
    
    // Card padding
    cardPadding: 'p-6', // 24px
    cardPaddingLarge: 'p-8', // 32px
  },

  // Border Styles
  borders: {
    default: 'border border-neutral-200/60',
    subtle: 'border border-neutral-200/40',
    strong: 'border border-neutral-300',
    dashed: 'border border-dashed border-neutral-200',
  },

  // Border Radius
  radius: {
    small: 'rounded-lg',
    medium: 'rounded-xl',
    large: 'rounded-2xl',
    full: 'rounded-full',
  },

  // Shadow System
  shadows: {
    none: 'shadow-none',
    sm: 'shadow-sm',
    default: 'shadow-sm',
    md: 'shadow-md',
    premium: 'shadow-premium',
    premiumMd: 'shadow-premium-md',
    premiumLg: 'shadow-premium-lg',
  },

  // Background Colors
  backgrounds: {
    page: 'bg-neutral-50',
    card: 'bg-white',
    subtle: 'bg-neutral-50/50',
    hover: 'hover:bg-neutral-50',
  },

  // Text Colors
  text: {
    primary: 'text-neutral-950',
    secondary: 'text-neutral-700',
    tertiary: 'text-neutral-600',
    muted: 'text-neutral-500',
    subtle: 'text-neutral-400',
  },

  // Interactive States
  interactive: {
    transition: 'transition-all duration-150 ease-out',
    hover: 'hover:-translate-y-0.5',
    hoverShadow: 'hover:shadow-md',
    active: 'active:scale-[0.98]',
    focus: 'focus:outline-none focus:ring-2 focus:ring-neutral-900/10',
  },

  // Card Variants
  cards: {
    default: 'rounded-2xl border border-neutral-200/60 bg-white shadow-sm',
    interactive: 'rounded-2xl border border-neutral-200/60 bg-white shadow-sm transition-all duration-150 ease-out hover:shadow-md hover:-translate-y-0.5',
    flat: 'rounded-2xl bg-white border border-neutral-200/60',
  },

  // Button Variants
  buttons: {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  },

  // Animation Classes
  animations: {
    fadeIn: 'animate-fade-in',
    slideIn: 'animate-slide-in',
    scaleIn: 'animate-scale-in',
  },

  // Status Colors
  status: {
    success: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-700',
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
    },
    neutral: {
      bg: 'bg-neutral-100',
      border: 'border-neutral-200',
      text: 'text-neutral-700',
    },
  },
} as const;

// Utility function to combine classes
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Common component compositions
export const commonStyles = {
  // Page Container
  pageContainer: 'container-premium py-8 lg:py-12',
  
  // Dashboard Grid
  dashboardGrid: 'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3',
  dashboardGridTwoCol: 'grid grid-cols-1 gap-6 lg:grid-cols-2',
  
  // Stat Cards Grid
  statGrid: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4',
  
  // Section Header
  sectionHeader: 'flex items-center justify-between',
  
  // Form Group
  formGroup: 'space-y-2',
  formLabel: 'text-sm font-medium text-neutral-700',
  formHint: 'text-xs text-neutral-500',
  formError: 'text-xs text-red-600',
  
  // Modal Overlay
  modalOverlay: 'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-fade-in',
  modalContent: 'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 animate-scale-in',
  
  // Skeleton Loader
  skeleton: 'animate-pulse rounded-lg bg-neutral-200/50',
  skeletonShimmer: 'animate-shimmer bg-gradient-to-r from-neutral-200/50 via-neutral-100 to-neutral-200/50 bg-[length:1000px_100%]',
} as const;

export default designSystem;
