import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { updateServiceProviderApplicationStatus } from '@/lib/provider-applications/service';

const updateSchema = z.object({
  status: z.enum(['pending', 'under_review', 'approved', 'rejected']),
  admin_notes: z.string().trim().max(1500).optional().or(z.literal('')),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const payload = (await request.json().catch(() => null)) as unknown;
  const parsed = updateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid provider application update payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const application = await updateServiceProviderApplicationStatus(auth.context.supabase, id, {
      status: parsed.data.status,
      admin_notes: parsed.data.admin_notes?.trim() ? parsed.data.admin_notes.trim() : null,
      reviewed_by: auth.context.user.id,
    });

    return NextResponse.json({ application });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update provider application' },
      { status: 500 },
    );
  }
}
