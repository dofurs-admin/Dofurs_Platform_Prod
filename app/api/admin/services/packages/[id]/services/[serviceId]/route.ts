import { NextResponse } from 'next/server';
/**
 * Admin package composition endpoints are deprecated; service-only booking is enforced.
 */

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; serviceId: string }> }
) {
  void _request;
  void context;
  return NextResponse.json(
    {
      success: false,
      error: 'Service packages are no longer supported. Use service bookings only.',
    },
    { status: 410 },
  );
}

