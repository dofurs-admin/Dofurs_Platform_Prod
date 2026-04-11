import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { logProviderAdminAuditEvent, verifyDocument } from '@/lib/provider-management/service';
import { verifyDocumentSchema } from '@/lib/provider-management/validation';

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
  const parsed = verifyDocumentSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const document = await verifyDocument(supabase, id, parsed.data.verificationStatus);
    await logProviderAdminAuditEvent(supabase, user.id, document.provider_id, 'provider.document_verified', {
      documentId: id,
      verificationStatus: parsed.data.verificationStatus,
    });
    return NextResponse.json({ success: true, document });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to verify document';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
