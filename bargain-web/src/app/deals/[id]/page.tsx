import type { Metadata } from "next";
import DealPageClient from "../detail/DealPageClient";
import { getPublicDeal } from "@/lib/api";
import { retailerName } from "@/lib/seo-helpers";
import { stringifyJsonLd } from "@/lib/jsonld";

// Dynamic deal detail route: /deals/:id
// Static sibling routes (today, best, calendar, etc.) take precedence over this
// dynamic segment in Next.js routing, so they are unaffected.
// The client component reads the deal ID from window.location.pathname.
export function generateStaticParams() {
  // No deal IDs are known at build time; all are rendered on demand.
  // Returning [] keeps `output: "export"` (legacy CF Pages path) buildable.
  return [];
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
  try {
    const deal = await getPublicDeal(id);
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
        images: deal.image_url
          ? [{ url: deal.image_url, alt: deal.title }]
          : undefined,
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
  } catch {
    return {
      ...FALLBACK,
      robots: { index: false },
    };
  }
}

// Server-rendered Product JSON-LD — the same fetch as generateMetadata is
// deduped by Next within the request, so this costs no extra API call and
// puts the schema in the initial HTML (the client component only renders
// deal data after hydration).
export default async function DealByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let productJsonLd: Record<string, unknown> | null = null;
  try {
    const deal = await getPublicDeal(id);
    const retailer = retailerName(deal.retailer);
    const savings =
      deal.historical_avg && deal.historical_avg > deal.buy_price
        ? deal.historical_avg - deal.buy_price
        : null;
    productJsonLd = {
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
        priceValidUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
      },
    };
  } catch {
    productJsonLd = null;
  }

  return (
    <>
      {productJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: stringifyJsonLd(productJsonLd) }}
        />
      )}
      <DealPageClient />
    </>
  );
}
