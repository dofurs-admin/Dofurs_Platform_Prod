import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getProviderIdByUserId } from '@/lib/provider-management/api';
import { createProviderDocument, getProviderDocuments } from '@/lib/provider-management/service';
import { providerDocumentCreateSchema } from '@/lib/provider-management/validation';

export async function GET() {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'provider' && role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  try {
    const providerId = await getProviderIdByUserId(supabase, user.id);

    if (!providerId) {
      return NextResponse.json({ error: 'Provider profile is not linked to this account.' }, { status: 404 });
    }

    const documents = await getProviderDocuments(supabase, providerId);
    return NextResponse.json({ documents });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load documents';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'provider' && role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  const payload = await request.json().catch(() => null);
  const parsed = providerDocumentCreateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const providerId = await getProviderIdByUserId(supabase, user.id);

    if (!providerId) {
      return NextResponse.json({ error: 'Provider profile is not linked to this account.' }, { status: 404 });
    }

    const document = await createProviderDocument(supabase, providerId, parsed.data);
    return NextResponse.json({ success: true, document });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save document';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
