import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.bargainhuntrs.com';

// Short link used in social posts: https://bargainhuntrs.com/d/{deal_id}
// Redirects to the API click-tracking endpoint, which logs the click and
// 302s to the affiliate URL. Query params (utm_source, etc.) pass through.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deal_id: string }> }
) {
  const { deal_id } = await params;
  const target = `${API_URL}/api/v1/arbitrage/d/${encodeURIComponent(deal_id)}${request.nextUrl.search}`;
  return NextResponse.redirect(target, 302);
}
