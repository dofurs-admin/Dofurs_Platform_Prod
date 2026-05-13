import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Dofurs — Premium Pet Services in Bangalore',
    short_name: 'Dofurs',
    description:
      'Book verified pet grooming, vet home visits, boarding, sitting, training and birthday services across Bangalore.',
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
