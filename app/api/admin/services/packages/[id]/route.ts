import { NextResponse } from 'next/server';
/**
 * Admin package endpoints are deprecated; service-only booking is enforced.
 */

// UPDATE PACKAGE
export async function PUT(
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

// DELETE PACKAGE
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
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

