import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In | Dofurs',
  description: 'Sign in to Dofurs and unlock trusted pet care services in Bangalore.',
  alternates: {
    canonical: '/auth/sign-in',
  },
  icons: {
    icon: '/logo/fav0d.png',
    shortcut: '/logo/fav0d.png',
    apple: '/logo/fav0d.png',
  },
  openGraph: {
    title: 'Join Dofurs with Referral Benefits',
    description: 'Use a referral code while signing up and get instant Dofurs Credits.',
    siteName: 'Dofurs',
    type: 'website',
    url: '/auth/sign-in',
    images: [
      {
        url: '/logo/fav0d.png',
        width: 525,
        height: 578,
        alt: 'Dofurs favicon',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Join Dofurs with Referral Benefits',
    description: 'Use a referral code while signing up and get instant Dofurs Credits.',
    images: ['/logo/fav0d.png'],
  },
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
