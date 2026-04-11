import UserOwnerProfileClient from '@/components/dashboard/UserOwnerProfileClient';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { getOwnerProfileAggregate } from '@/lib/owner-profile/service';

export default async function UserProfilePage() {
  const { supabase, user } = await requireAuthenticatedUser();

  let aggregate = await getOwnerProfileAggregate(supabase, user.id);

  if (!aggregate) {
    const { data: legacyProfile } = await supabase
      .from('users')
      .select('name, phone, photo_url, gender')
      .eq('id', user.id)
      .maybeSingle<{
        name: string | null;
        phone: string;
        photo_url: string | null;
        gender: string | null;
      }>();

    if (legacyProfile?.phone) {
      const fullName = legacyProfile.name?.trim() || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Pet Owner';

      await supabase.from('profiles').upsert(
        {
          id: user.id,
          full_name: fullName,
          phone_number: legacyProfile.phone,
          profile_photo_url: legacyProfile.photo_url,
          gender: legacyProfile.gender,
        },
        { onConflict: 'id' },
      );

      aggregate = await getOwnerProfileAggregate(supabase, user.id);
    }
  }

  if (!aggregate) {
    return (
      <div className="rounded-3xl border border-[#ead3bf] bg-[linear-gradient(180deg,#fffdf9_0%,#fff3e8_100%)] p-6 shadow-[0_14px_28px_rgba(147,101,63,0.12)]">
        <p className="text-sm font-semibold text-red-700">Could not load your owner profile right now.</p>
        <p className="mt-1 text-sm leading-relaxed text-neutral-700">Complete profile setup first, then refresh this page.</p>
      </div>
    );
  }

  return (
    <UserOwnerProfileClient
      userId={user.id}
      initialProfile={aggregate.profile}
      initialAddresses={aggregate.addresses}
      initialContacts={aggregate.emergencyContacts}
      initialPreferences={aggregate.preferences}
    />
  );
}
