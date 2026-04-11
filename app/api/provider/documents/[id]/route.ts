import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getProviderIdByUserId } from '@/lib/provider-management/api';
import { deleteProviderDocument, updateProviderDocument } from '@/lib/provider-management/service';
import { providerDocumentPatchSchema } from '@/lib/provider-management/validation';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'provider' && role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  const payload = await request.json().catch(() => null);
  const parsed = providerDocumentPatchSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await context.params;

  try {
    const providerId = await getProviderIdByUserId(supabase, user.id);

    if (!providerId) {
      return NextResponse.json({ error: 'Provider profile is not linked to this account.' }, { status: 404 });
    }

    const document = await updateProviderDocument(supabase, providerId, id, parsed.data);
    return NextResponse.json({ success: true, document });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update document';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'provider' && role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  const { id } = await context.params;

  try {
    const providerId = await getProviderIdByUserId(supabase, user.id);

    if (!providerId) {
      return NextResponse.json({ error: 'Provider profile is not linked to this account.' }, { status: 404 });
    }

    await deleteProviderDocument(supabase, providerId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete document';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
