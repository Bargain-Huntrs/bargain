import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_URL =
  process.env.API_INTERNAL_URL || "https://bargain-api.settleinpeace.com";

async function probe(name: string, path: string, timeoutMs: number) {
  const start = Date.now();
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { "User-Agent": "BargainHuntrs-Sitemap/1.0" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.json().catch(() => null);
    return {
      name,
      ok: res.ok,
      status: res.status,
      ms: Date.now() - start,
      isArray: Array.isArray(body),
      count: Array.isArray(body) ? body.length : -1,
    };
  } catch (err) {
    return {
      name,
      ok: false,
      status: -1,
      ms: Date.now() - start,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    };
  }
}

export async function GET() {
  const results = await Promise.all([
    probe("deals", "/api/v1/arbitrage/deals/public?limit=200&offset=0", 5000),
    probe("retailers", "/api/v1/arbitrage/deals/public-retailers", 5000),
    probe("coupons", "/api/v1/coupons/public/retailers", 5000),
    probe("deals-long", "/api/v1/arbitrage/deals/public?limit=200&offset=0", 30000),
  ]);
  return NextResponse.json({ results, at: new Date().toISOString() });
}
