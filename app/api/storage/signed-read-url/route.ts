import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { listAccessiblePetsForUser } from '@/lib/pets/share-access';

const readSchema = z.object({
  bucket: z.enum(['user-photos', 'pet-photos', 'service-images']),
  path: z.string().min(1),
  expiresIn: z.number().int().min(60).max(3600).optional(),
});

function normalizeStoragePathCandidate(value: string | null | undefined, bucket: 'user-photos' | 'pet-photos' | 'service-images') {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const stripBucketPrefix = (input: string) => input.replace(/^\/+/, '').replace(new RegExp(`^${bucket}/`), '');

  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/storage/v1/object/')) {
    return stripBucketPrefix(trimmed);
  }

  try {
    const parsed = new URL(trimmed, trimmed.startsWith('http') ? undefined : 'http://localhost');
    const segments = parsed.pathname.split('/').filter(Boolean);
    const markerIndex = segments.findIndex(
      (segment, index) => segment === 'storage' && segments[index + 1] === 'v1' && segments[index + 2] === 'object',
    );

    if (markerIndex === -1) {
      return stripBucketPrefix(trimmed);
    }

    const objectSegments = segments.slice(markerIndex + 3);
    const first = objectSegments[0];
    if (!first) {
      return null;
    }

    const modeOffsets: Record<string, number> = {
      sign: 1,
      public: 1,
      authenticated: 1,
      render: 2,
    };

    const offset = modeOffsets[first] ?? 0;
    const bucketCandidate = objectSegments[offset];
    const pathParts = objectSegments.slice(offset + 1);

    if (bucketCandidate !== bucket || pathParts.length === 0) {
      return null;
    }

    return decodeURIComponent(pathParts.join('/'));
  } catch (err) { console.error(err);
    return stripBucketPrefix(trimmed);
  }
}

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const adminSupabase = getSupabaseAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null;

  let bearerUser = null;
  if (accessToken) {
    const { data: bearerData } = await adminSupabase.auth.getUser(accessToken);
    bearerUser = bearerData.user ?? null;
  }

  const authUser = user ?? session?.user ?? bearerUser;

  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = readSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const normalizedPath = parsed.data.path
    .trim()
    .replace(/^\/+/, '')
    .replace(/^user-photos\//, '')
    .replace(/^pet-photos\//, '')
    .replace(/^service-images\//, '');
  const ownerPrefix = `${authUser.id}/`;
  let canAccess = normalizedPath.startsWith(ownerPrefix);

  // Allow access to profile images explicitly linked to the current user.
  // This covers admin-uploaded provider photos that are stored under admin-owned prefixes.
  if (!canAccess && parsed.data.bucket === 'user-photos') {
    const [userPhotoRow, ownerProfileRow, providerPhotoRow] = await Promise.all([
      supabase
        .from('users')
        .select('photo_url')
        .eq('id', authUser.id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('profile_photo_url')
        .eq('id', authUser.id)
        .maybeSingle(),
      supabase
        .from('providers')
        .select('profile_photo_url')
        .eq('user_id', authUser.id)
        .limit(1)
        .maybeSingle(),
    ]);

    const normalizedLinkedPaths = [
      normalizeStoragePathCandidate(userPhotoRow.data?.photo_url ?? null, 'user-photos'),
      normalizeStoragePathCandidate(ownerProfileRow.data?.profile_photo_url ?? null, 'user-photos'),
      normalizeStoragePathCandidate(providerPhotoRow.data?.profile_photo_url ?? null, 'user-photos'),
    ];

    canAccess = normalizedLinkedPaths.includes(normalizedPath);
  }

  // Allow access to pet photos explicitly linked to the current user's pets.
  // This covers legacy rows that may not follow the strict <user_id>/ prefix.
  if (!canAccess && parsed.data.bucket === 'pet-photos') {
    try {
      const accessiblePets = await listAccessiblePetsForUser(adminSupabase, authUser.id);

      const normalizedPetPhotoPaths = accessiblePets
        .map((pet) => normalizeStoragePathCandidate(pet.photo_url ?? null, 'pet-photos'))
        .filter((path): path is string => Boolean(path));

      canAccess = normalizedPetPhotoPaths.includes(normalizedPath);
    } catch (err) { console.error(err);
      // Fallback to owned pets only if shared-pet lookup is unavailable.
      const petRows = await supabase
        .from('pets')
        .select('photo_url')
        .eq('user_id', authUser.id)
        .not('photo_url', 'is', null)
        .limit(500);

      const normalizedPetPhotoPaths = (petRows.data ?? [])
        .map((row) => normalizeStoragePathCandidate(row.photo_url ?? null, 'pet-photos'))
        .filter((path): path is string => Boolean(path));

      canAccess = normalizedPetPhotoPaths.includes(normalizedPath);
    }
  }

  if (!canAccess) {
    const { data: dbUser } = await supabase
      .from('users')
      .select('roles(name)')
      .eq('id', authUser.id)
      .single();

    const roleName = (Array.isArray(dbUser?.roles) ? dbUser?.roles[0] : dbUser?.roles)?.name;
    if (roleName !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { data, error } = await adminSupabase
    .storage
    .from(parsed.data.bucket)
    .createSignedUrl(normalizedPath, parsed.data.expiresIn ?? 300);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create signed read URL' }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl });
}
