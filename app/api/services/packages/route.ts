import { NextRequest, NextResponse } from "next/server";
/**
 * GET /api/services/packages
 * Package catalog is deprecated; service-only booking is enforced.
 */

export async function GET(request: NextRequest) {
  void request;
  return NextResponse.json(
    {
      success: false,
      error: 'Service packages are no longer supported. Use service bookings only.',
    },
    { status: 410 },
  );
}
