import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Dofurs — Premium Pet Grooming in Bengaluru',
    short_name: 'Dofurs',
    description:
      'Book verified doorstep pet grooming across Bengaluru with transparent packages and pet-safe products.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fff8f0',
    theme_color: '#e39a5d',
    lang: 'en-IN',
    categories: ['lifestyle', 'pets', 'shopping', 'utilities'],
    icons: [
      {
        src: '/logo/fav0d.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo/brand-logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo/brand-logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
