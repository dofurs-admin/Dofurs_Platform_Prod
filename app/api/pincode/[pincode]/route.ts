import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited } from '@/lib/api/rate-limit';

type PostOffice = {
  Name: string;
  District: string;
  State: string;
  Country: string;
  Pincode: string;
};

type IndiaPostResponse = {
  Message: string;
  Status: string;
  PostOffice: PostOffice[] | null;
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ pincode: string }> }) {
  // Rate limit by IP to prevent abuse of external India Post API
  const clientIp = _request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rate = isRateLimited(`pincode:${clientIp}`, { windowMs: 60_000, maxRequests: 20 });
  if (rate.limited) {
    return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 });
  }

  const { pincode } = await params;

  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json({ city: null, state: null, country: null }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json({ city: null, state: null, country: null });
    }

    const data = (await response.json()) as IndiaPostResponse[];
    const entry = data?.[0];

    if (entry?.Status !== 'Success' || !entry.PostOffice?.length) {
      return NextResponse.json({ city: null, state: null, country: null });
    }

    const office = entry.PostOffice[0];

    return NextResponse.json(
      { city: office.District, state: office.State, country: office.Country || 'India' },
      { headers: { 'Cache-Control': 'public, max-age=86400' } },
    );
  } catch (err) { console.error(err);
    return NextResponse.json({ city: null, state: null, country: null });
  }
}
