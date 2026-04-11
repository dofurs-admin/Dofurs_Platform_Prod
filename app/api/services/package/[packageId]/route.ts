import { NextRequest, NextResponse } from "next/server";
/**
 * GET /api/services/package/[packageId]
 * Package composition is deprecated; service-only booking is enforced.
 */

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ packageId: string }> }
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
