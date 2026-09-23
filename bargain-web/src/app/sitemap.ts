import type { MetadataRoute } from "next";

// Replaces the old Cloudflare Pages Function (functions/sitemap.xml.ts) which
// returned 404 under the OpenNext Workers deployment. Fetches active deals
// from the public API at request time, paginating 200 at a time.

const BASE_URL = "https://www.bargainhuntrs.com";
const API_URL = "https://api.bargainhuntrs.com";
const MAX_LIMIT = 200;

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: "hourly", priority: 1.0 },
    { url: `${BASE_URL}/deals`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/categories`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/deals/best`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/deals/amazon`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/deals/today`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/deals/amazon-deals`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${BASE_URL}/deals/walmart-deals`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${BASE_URL}/deals/clearance`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${BASE_URL}/deals/trending`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE_URL}/deals/retailers`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE_URL}/retailers`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/deals/calendar`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/community`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE_URL}/seller`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE_URL}/waitlist`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE_URL}/coupons`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE_URL}/real-estate`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/real-estate/deals`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/auctions`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${BASE_URL}/tools/profit-calculator`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/tools/real-estate-calculator`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/tools/listing-generator`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/guides`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/guides/how-to-find-price-glitches`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/guides/amazon-arbitrage-guide`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/guides/retail-arbitrage-for-beginners`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/guides/best-times-to-find-deals`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ];

  let dealUrls: MetadataRoute.Sitemap = [];
  try {
    for (let offset = 0; offset < 2000; offset += MAX_LIMIT) {
      const res = await fetch(
        `${API_URL}/api/v1/arbitrage/deals/public?limit=${MAX_LIMIT}&offset=${offset}`,
        { headers: { "User-Agent": "BargainHuntrs-Sitemap/1.0" } }
      );
      if (!res.ok) break;
      const deals = await res.json();
      if (!Array.isArray(deals) || deals.length === 0) break;
      dealUrls.push(
        ...deals.map((deal: any) => ({
          url: `${BASE_URL}/deals/${deal.id}`,
          lastModified: deal.detected_at || deal.updated_at || now,
          changeFrequency: "daily" as const,
          priority: 0.7,
        }))
      );
      if (deals.length < MAX_LIMIT) break;
    }
  } catch {
    // If the API is unreachable, return static pages only
  }

  return [...staticUrls, ...dealUrls];
}
