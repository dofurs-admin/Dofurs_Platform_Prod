import { NextResponse } from 'next/server';
/**
 * Admin package endpoints are deprecated; service-only booking is enforced.
 */

// CREATE PACKAGE
export async function POST(request: Request) {
  void request;
  return NextResponse.json(
    {
      success: false,
      error: 'Service packages are no longer supported. Use service bookings only.',
    },
    { status: 410 },
  );
}

