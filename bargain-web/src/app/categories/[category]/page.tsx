import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getPublicDeals, type ArbitrageDeal } from "@/lib/api";
import {
  DEAL_CATEGORIES,
  categoryBySlug,
  inferDealCategory,
} from "@/lib/deal-categories";
import { discountPercent } from "@/lib/seo-helpers";
import SeoPageLayout from "@/components/SeoPageLayout";

export const revalidate = 3600;

// All 11 category landing pages are known at build time.
export function generateStaticParams() {
  return DEAL_CATEGORIES.map((c) => ({ category: c.slug }));
}

type Params = { category: string };

const BASE_URL = "https://www.bargainhuntrs.com";
const PAGE_SIZE = 200; // API hard-caps limit at 200 — paginate like sitemap.ts
const MAX_DEALS_TOTAL = 1000;
const MAX_DEALS_SHOWN = 48;

// React cache() dedupes this across generateMetadata + the page render
// within a single request, so the deal fetches happen once per hit.
const getAllPublicDeals = cache(async (): Promise<ArbitrageDeal[]> => {
  const deals: ArbitrageDeal[] = [];
  try {
    for (let offset = 0; offset < MAX_DEALS_TOTAL; offset += PAGE_SIZE) {
      const batch = await getPublicDeals(PAGE_SIZE, offset);
      if (!Array.isArray(batch) || batch.length === 0) break;
      deals.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
  } catch {
    // Partial results are fine — return whatever loaded before the failure.
  }
  return deals;
});

function dealsForCategory(name: string, deals: ArbitrageDeal[]): ArbitrageDeal[] {
  return deals
    .filter((d) => inferDealCategory(d) === name)
    .sort(
      (a, b) =>
        discountPercent(b) - discountPercent(a) ||
        new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
    )
    .slice(0, MAX_DEALS_SHOWN);
}

// Unique 2-3 sentence intro per category — what we track and where the
// deals come from. Kept as static copy so every page has distinct,
// indexable body text even when the deal feed is momentarily empty.
const CATEGORY_INTROS: Record<string, string> = {
  electronics:
    "BargainHuntrs scans hundreds of electronics retailers around the clock for laptops, headphones, TVs, wearables, and accessories. This page collects every live price drop, clearance markdown, and coupon-stacked bargain we detect in electronics — sorted by discount so the deepest cuts surface first. Price glitches and limited-stock doorbusters move fast, so check back hourly.",
  "home-kitchen":
    "From air fryers and blenders to mattresses and furniture, our scanners watch major home and kitchen retailers for markdowns you can flip or keep. We track price drops, clearance events, and verified promo codes across the category and rank everything by percentage off. New finds land here throughout the day as our crawlers refresh.",
  "beauty-care":
    "Beauty and personal care deals move quickly — skincare serums, fragrance, hair tools, and cosmetics get discounted hard during sales events. BargainHuntrs flags each price drop and clearance find with the discount percentage so you can spot the real bargains at a glance. Bookmark this page for the freshest beauty deals of the day.",
  "clothing-shoes":
    "Apparel and footwear discounts are some of the most flip-friendly deals online. We monitor clothing, shoe, and accessory listings across major retailers and surface price errors, clearance racks, and coupon deals the moment they're detected. Every card links to the live deal so you can verify the price before it disappears.",
  "toys-games":
    "Toys and games see dramatic price swings around holidays and new releases — exactly when resellers win. Our scanners catch the dips: LEGO sets, board games, action figures, and gaming accessories at their lowest detected prices. Check this page daily during peak shopping seasons for the deepest cuts.",
  "sports-outdoors":
    "Fitness gear, camping equipment, and outdoor recreation products are discounted heavily by season. BargainHuntrs tracks price drops, clearance events, and promo-code savings across sports and outdoors retailers, ranking each find by how far below its typical price it sits. Great for stocking up before peak season or flipping into it.",
  "tools-auto":
    "Power tools and automotive parts carry some of the highest margins in retail arbitrage. We watch tool brands like DeWalt, Milwaukee, and Ryobi plus tires, mechanics' supplies, and car accessories for price glitches and clearance. Deals here are sorted by discount percentage — the biggest spreads sit at the top.",
  "baby-kids":
    "Baby gear and kids' products — strollers, car seats, diapers, toys — are expensive new and discounted fast. Our scanners catch price drops and clearance events across baby and kids' retailers so you can buy low whether you're a parent or a reseller. New finds appear here as soon as they're detected.",
  "pet-supplies":
    "Pet owners spend consistently, which makes pet supplies a reliable arbitrage category. BargainHuntrs tracks food, toys, aquarium gear, and accessories for price drops and coupon savings across major pet retailers. Every listing shows the discount off the typical price so you know exactly how good the deal is.",
  "grocery-health":
    "Vitamins, supplements, snacks, and health products are discounted constantly by online retailers. We monitor grocery and health listings for price errors, bulk-buy savings, and promo-code deals, surfacing the deepest percentage cuts first. Stock up on staples or flip the big-ticket wellness items.",
  other:
    "This catch-all bucket holds live deals our scanners couldn't place into a specific category — everything from unusual finds to newly discovered product types. Even uncategorized deals get the same treatment: price-drop detection, discount percentages, and direct links to verify at the retailer. Check back often as new products and categories emerge.",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = categoryBySlug(category);
  if (!cat) return { title: "Category Not Found", robots: { index: false } };

  const allDeals = await getAllPublicDeals();
  const deals = dealsForCategory(cat.name, allDeals);
  const count = deals.length;

  const maxDiscount = deals.reduce(
    (max, d) => Math.max(max, discountPercent(d)),
    0
  );
  const discountPhrase = maxDiscount > 0 ? ` Up to ${maxDiscount}% Off` : "";
  const title = `${cat.name} Deals — Live Discounts${discountPhrase} | BargainHuntrs`;
  const description = `Browse ${count} live ${cat.name.toLowerCase()} deals — price drops, clearance, and coupon savings from major retailers. Updated hourly by BargainHuntrs scanners.`;

  return {
    title,
    description,
    alternates: { canonical: `/categories/${cat.slug}` },
    openGraph: {
      type: "website",
      siteName: "BargainHuntrs",
      title,
      description,
      url: `/categories/${cat.slug}`,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: `${cat.name} Deals` }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@bargain4huntrs",
      creator: "@bargain4huntrs",
      title,
      description,
      images: ["/og-image.png"],
    },
  };
}

export default async function CategoryDealsPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { category } = await params;
  const cat = categoryBySlug(category);
  if (!cat) notFound();

  const allDeals = await getAllPublicDeals();
  const deals = dealsForCategory(cat.name, allDeals);

  const pageUrl = `${BASE_URL}/categories/${cat.slug}`;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${cat.name} Deals`,
    url: pageUrl,
    numberOfItems: deals.length,
    itemListElement: deals.map((deal, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE_URL}/deals/${deal.id}`,
      name: deal.title,
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: BASE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Categories",
        item: `${BASE_URL}/categories`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: cat.name,
        item: pageUrl,
      },
    ],
  };

  // Internal links to sibling categories — crawlable paths for search
  // engines and useful navigation for shoppers.
  const siblingLinks = DEAL_CATEGORIES.filter((c) => c.slug !== cat.slug)
    .slice(0, 6)
    .map((c) => ({ href: `/categories/${c.slug}`, label: `${c.name} Deals` }));

  return (
    <SeoPageLayout
      config={{
        title: `${cat.name} Deals`,
        description: `Live ${cat.name.toLowerCase()} deals — price drops, clearance, and coupon savings updated hourly.`,
        backLink: "/categories",
        backLabel: "← All categories",
        source: `category_${cat.slug}`,
        introContent: <p>{CATEGORY_INTROS[cat.slug] || CATEGORY_INTROS.other}</p>,
        jsonLd: [itemListJsonLd, breadcrumbJsonLd],
        relatedLinks: [
          { href: "/deals", label: "All Live Deals" },
          { href: "/deals/clearance", label: "Clearance Deals" },
          { href: "/deals/today", label: "Today's Deals" },
          ...siblingLinks,
        ],
      }}
      deals={deals}
    />
  );
}
