import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import DealPageClient from "../detail/DealPageClient";
import {
  getPublicDeal,
  getPublicDealPriceHistory,
  type ArbitrageDeal,
  type DealPriceHistory,
} from "@/lib/api";
import { retailerName } from "@/lib/seo-helpers";
import { stringifyJsonLd } from "@/lib/jsonld";

// Deals change through the day; on-demand ISR keeps first-hit HTML fresh
// while CDN-caching repeat views — same cadence as /stores/[slug].
export const revalidate = 1800;

// Dynamic deal detail route: /deals/:id
// Static sibling routes (today, best, calendar, etc.) take precedence over this
// dynamic segment in Next.js routing, so they are unaffected.
export function generateStaticParams() {
  // No deal IDs are known at build time; all are rendered on demand.
  // Returning [] keeps `output: "export"` (legacy CF Pages path) buildable.
  return [];
}

// The public API only serves deals by UUID — anything else (old category
// slugs like /deals/under-25, junk crawler paths) is a hard 404 without
// even bothering the upstream.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One fetch shared by generateMetadata + the page component — React's cache()
// dedupes it within a single request so the deal body costs one API call.
const getDeal = cache(async (id: string): Promise<ArbitrageDeal | null> => {
  if (!UUID_RE.test(id)) return null;
  try {
    return await getPublicDeal(id);
  } catch {
    // The public endpoint 404s for missing AND expired/archived deals, so a
    // null here means "no live deal at this URL" — the page maps it to
    // notFound() (404 status, noindex).
    return null;
  }
});

async function getPriceHistory(
  id: string,
): Promise<DealPriceHistory | null> {
  try {
    return await getPublicDealPriceHistory(id);
  } catch {
    // History is supplemental — never let it break the page.
    return null;
  }
}

const FALLBACK: Metadata = {
  title: "Deal Details",
  description: "View this deal on BargainHuntrs — find it, flip it, profit.",
};

// Per-deal metadata: indexed deal pages and shared/social links get the real
// product title, price, and image instead of a generic card.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal) {
    return {
      ...FALLBACK,
      robots: { index: false },
    };
  }
  const retailer = retailerName(deal.retailer);
  const price = `$${deal.buy_price.toFixed(2)}`;
  const discount =
    deal.historical_avg && deal.historical_avg > deal.buy_price
      ? Math.round((1 - deal.buy_price / deal.historical_avg) * 100)
      : 0;
  const description = discount
    ? `${deal.title} — ${price} at ${retailer} (${discount}% off). Live deal on BargainHuntrs.`
    : `${deal.title} — ${price} at ${retailer}. Live deal on BargainHuntrs.`;
  const title = `${deal.title} — ${price}`;

  return {
    title,
    description,
    alternates: { canonical: `/deals/${id}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: `/deals/${id}`,
      images: deal.image_url ? [{ url: deal.image_url, alt: deal.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      site: "@bargain4huntrs",
      creator: "@bargain4huntrs",
      title,
      description,
      images: deal.image_url ? [deal.image_url] : undefined,
    },
  };
}

// Server-rendered deal page: the deal body (title, price, merchant, tracked
// buy link, price history) lands in the initial HTML so crawlers — and the
// Skimlinks/Affilired link-approval reviewers — see a real page instead of a
// client-hydrated skeleton. Interactive bits (dead-deal report, SI verdict)
// stay client-side inside DealPageClient.
export default async function DealByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal) {
    // Missing IDs and expired/archived deals both 404 — Next emits a real
    // 404 status + noindex (the archived-deal equivalent of a 410).
    notFound();
  }

  const [history] = await Promise.all([getPriceHistory(deal.id)]);

  const retailer = retailerName(deal.retailer);
  const savings =
    deal.historical_avg && deal.historical_avg > deal.buy_price
      ? deal.historical_avg - deal.buy_price
      : null;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: deal.title,
    image: deal.image_url ? [deal.image_url] : undefined,
    description: savings
      ? `$${deal.buy_price.toFixed(2)} (was $${deal.historical_avg!.toFixed(
          2,
        )}) at ${retailer}. Save $${savings.toFixed(2)}.`
      : `$${deal.buy_price.toFixed(2)} at ${retailer}.`,
    brand: { "@type": "Brand", name: retailer },
    offers: {
      "@type": "Offer",
      price: deal.buy_price.toFixed(2),
      priceCurrency: "USD",
      url: deal.buy_url || `https://www.bargainhuntrs.com/deals/${deal.id}`,
      availability:
        deal.status === "active"
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      // Offer-expiry is legitimately relative to render time (server
      // component on an ISR page), so the purity rule is waived here.
      /* eslint-disable react-hooks/purity */
      priceValidUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      /* eslint-enable react-hooks/purity */
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(productJsonLd) }}
      />
      <DealPageClient deal={deal} initialHistory={history} />
    </>
  );
}
