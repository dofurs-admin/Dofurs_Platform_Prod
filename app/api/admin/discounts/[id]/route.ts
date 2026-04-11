import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { deletePlatformDiscount, patchPlatformDiscount } from '@/lib/provider-management/service';
import { adminDiscountPatchSchema } from '@/lib/provider-management/validation';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { role, user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  const { id } = await context.params;
  const payload = await request.json().catch(() => null);
  const parsed = adminDiscountPatchSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const discount = await patchPlatformDiscount(supabase, id, parsed.data);
    return NextResponse.json({ success: true, discount });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update discount';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { role, user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  const { id } = await context.params;

  try {
    await deletePlatformDiscount(supabase, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete discount';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
