import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);
const MAX_FILE_SIZE_MB = 10;

const uploadSchema = z.object({
  bucket: z.enum(['user-photos', 'pet-photos', 'service-images']),
  fileName: z.string().min(1),
  contentType: z.string().optional(),
  fileSizeMB: z.number().max(MAX_FILE_SIZE_MB, `File size must be under ${MAX_FILE_SIZE_MB}MB`).optional(),
});

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
  const parsed = uploadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Validate file extension
  const ext = parsed.data.fileName.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: `File type not allowed. Accepted: ${[...ALLOWED_EXTENSIONS].join(', ')}` },
      { status: 400 }
    );
  }

  // Validate content type if provided
  if (parsed.data.contentType && !parsed.data.contentType.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
  }

  const sanitizedName = parsed.data.fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const objectPath = `${authUser.id}/${Date.now()}-${sanitizedName}`;

  const { data, error } = await adminSupabase.storage.from(parsed.data.bucket).createSignedUploadUrl(objectPath);

  if (error || !data) {
    const rawMessage = error?.message ?? 'Failed to create signed upload URL';
    const normalized = rawMessage.toLowerCase();

    const hint =
      normalized.includes('bucket') && (normalized.includes('not found') || normalized.includes('does not exist'))
        ? `Storage bucket \"${parsed.data.bucket}\" is missing. Apply storage migrations and retry.`
        : normalized.includes('policy') || normalized.includes('permission') || normalized.includes('unauthorized')
          ? `Storage permissions for bucket \"${parsed.data.bucket}\" are not configured for this user.`
          : null;

    return NextResponse.json({ error: rawMessage, details: hint }, { status: 500 });
  }

  return NextResponse.json({
    bucket: parsed.data.bucket,
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
  });
}
