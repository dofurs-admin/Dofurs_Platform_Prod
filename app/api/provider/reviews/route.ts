import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getProviderIdByUserId } from '@/lib/provider-management/api';
import { getProviderReviewsPage } from '@/lib/provider-management/service';
import { providerReviewsQuerySchema } from '@/lib/provider-management/validation';

export async function GET(request: Request) {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'provider' && role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsedQuery = providerReviewsQuerySchema.safeParse({
      page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
      pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : undefined,
      rating: searchParams.get('rating') ? Number(searchParams.get('rating')) : undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json({ error: 'Invalid query', details: parsedQuery.error.flatten() }, { status: 400 });
    }

    const providerId = await getProviderIdByUserId(supabase, user.id);

    if (!providerId) {
      return NextResponse.json({ error: 'Provider profile is not linked to this account.' }, { status: 404 });
    }

    const page = await getProviderReviewsPage(supabase, providerId, parsedQuery.data);
    return NextResponse.json(page);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load provider reviews';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
