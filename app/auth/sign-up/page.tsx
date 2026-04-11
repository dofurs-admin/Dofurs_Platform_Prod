import { redirect } from 'next/navigation';

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const merged = new URLSearchParams();
  merged.set('mode', 'signup');

  for (const [key, rawValue] of Object.entries(params)) {
    if (rawValue === undefined || key === 'mode') {
      continue;
    }

    if (Array.isArray(rawValue)) {
      for (const value of rawValue) {
        merged.append(key, value);
      }
    } else {
      merged.set(key, rawValue);
    }
  }

  redirect(`/auth/sign-in?${merged.toString()}`);
}
