import UserPetProfilesClient from '@/components/dashboard/UserPetProfilesClient';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { claimPendingPetShares, listAccessiblePetsForUser } from '@/lib/pets/share-access';

type UserPetProfilesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function parseSelectedPetId(value: string | string[] | undefined) {
  const resolved = Array.isArray(value) ? value[0] : value;
  if (!resolved) {
    return null;
  }

  const parsed = Number.parseInt(resolved, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export default async function UserPetProfilesPage({ searchParams }: UserPetProfilesPageProps) {
  const { user } = await requireAuthenticatedUser();
  const admin = getSupabaseAdminClient();
  await claimPendingPetShares(admin, user.id, user.email);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedPetId = parseSelectedPetId(resolvedSearchParams?.pet);

  const pets = await listAccessiblePetsForUser(admin, user.id);

  return <UserPetProfilesClient initialPets={pets} initialSelectedPetId={selectedPetId} />;
}
