import { NextResponse } from 'next/server';
/**
 * Admin package composition endpoints are deprecated; service-only booking is enforced.
 */

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  void request;
  void context;
  return NextResponse.json(
    {
      success: false,
      error: 'Service packages are no longer supported. Use service bookings only.',
    },
    { status: 410 },
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  void request;
  void context;
  return NextResponse.json(
    {
      success: false,
      error: 'Service packages are no longer supported. Use service bookings only.',
    },
    { status: 410 },
  );
}

