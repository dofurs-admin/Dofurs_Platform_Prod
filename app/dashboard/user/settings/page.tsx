import UserSettingsClient from '@/components/dashboard/UserSettingsClient';
import { requireAuthenticatedUser } from '@/lib/auth/session';

export default async function UserSettingsPage() {
  const { supabase, user } = await requireAuthenticatedUser();

  const { data: profile } = await supabase
    .from('users')
    .select('id, phone, name, email, address, age, gender, photo_url')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return (
      <div className="rounded-3xl border border-[#ead3bf] bg-[linear-gradient(180deg,#fffdf9_0%,#fff3e8_100%)] p-6 shadow-[0_14px_28px_rgba(147,101,63,0.12)]">
        <p className="text-sm font-semibold text-red-700">Could not load your settings profile right now.</p>
        <p className="mt-1 text-sm leading-relaxed text-neutral-700">Please sign in again.</p>
      </div>
    );
  }

  return <UserSettingsClient initialProfile={profile} />;
}
