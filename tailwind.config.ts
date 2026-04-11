import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Legacy colors (kept for backward compatibility)
        cream: '#f7f4ef',
        peach: '#fde8da',
        petal: '#fff8f2',
        coral: '#e39a5d',
        sand: '#f3ebe1',
        ink: '#1f1f1f',
        
        // Modern neutral palette (primary design system)
        brand: {
          50: '#fef7f3',
          100: '#fdeee5',
          200: '#fbdcc9',
          300: '#f7bfa2',
          400: '#f29870',
          500: '#ed7847',
          600: '#de5b2d',
          700: '#ba4723',
          800: '#953b22',
          900: '#79341f',
        },
      },
      fontSize: {
        // Unified typography scale
        'display': ['2.5rem', { lineHeight: '3rem', fontWeight: '700' }],
        'page-title': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
        'section-title': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '500' }],
        'card-title': ['1.125rem', { lineHeight: '1.75rem', fontWeight: '500' }],
      },
      spacing: {
        // Design system spacing
        '18': '4.5rem',
        '88': '22rem',
      },
      boxShadow: {
        // Premium subtle shadows
        'premium-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        'premium': '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08)',
        'premium-md': '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.08)',
        'premium-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.08)',
        'premium-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',

        // Gloss shadows — Apple-style specular highlight (inset top edge) variants
        'gloss': 'inset 0 1px 0 rgba(255, 255, 255, 0.9)',
        'gloss-warm': '0 8px 20px rgba(145, 92, 54, 0.09), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
        'gloss-premium': '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.88)',
        'gloss-premium-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.88)',
        'gloss-dark': 'inset 0 1px 0 rgba(255, 255, 255, 0.12)',

        // Legacy shadows (kept for backward compatibility)
        'soft-sm': '0 10px 22px -16px rgba(0, 0, 0, 0.22)',
        soft: '0 12px 30px -18px rgba(0, 0, 0, 0.25)',
        'soft-md': '0 18px 42px -22px rgba(0, 0, 0, 0.20)',
        'soft-lg': '0 28px 64px -30px rgba(0, 0, 0, 0.20)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      backgroundImage: {
        'hero-overlay': 'linear-gradient(120deg, rgba(247,244,239,0.80), rgba(253,232,218,0.56))',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-subtle': 'linear-gradient(to bottom, rgba(255,255,255,0), rgba(0,0,0,0.02))',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
