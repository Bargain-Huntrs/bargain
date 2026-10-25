import type { Metadata } from "next";
import { getPublicDeals, type ArbitrageDeal } from "@/lib/api";
import { discountPercent } from "@/lib/seo-helpers";
import SeoPageLayout from "@/components/SeoPageLayout";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Deals Under $10 — Cheapest Live Bargains Today | BargainHuntrs",
  description:
    "Live deals under $10 across Amazon, Walmart, Target, and hundreds of retailers. Impulse-buy bargains and stocking stuffers ranked by discount. Updated hourly.",
  alternates: { canonical: "/deals/under-10" },
  openGraph: {
    type: "website",
    siteName: "BargainHuntrs",
    title: "Deals Under $10 — Cheapest Live Bargains Today | BargainHuntrs",
    description:
      "Live deals under $10 across Amazon, Walmart, Target, and hundreds of retailers. Updated hourly.",
    url: "/deals/under-10",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Deals Under $10" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: "Deals Under $10 — Cheapest Live Bargains Today | BargainHuntrs",
    description:
      "Live deals under $10 across Amazon, Walmart, Target, and more.",
    images: ["/og-image.png"],
  },
};

const RELATED_LINKS = [
  { href: "/deals/today", label: "Today's Best Deals" },
  { href: "/deals/price-drops", label: "Price Drops" },
  { href: "/deals/over-50-off", label: "Over 50% Off" },
  { href: "/deals/clearance", label: "Clearance Deals" },
  { href: "/deals/walmart-deals", label: "Walmart Deals" },
];

const FAQS = [
  {
    question: "What kinds of deals are under $10?",
    answer:
      "Everything on this page is currently priced under ten dollars — accessories, household items, toys, beauty products, snacks, cables, and more. Many started at two or three times the price before the markdown.",
  },
  {
    question: "Are under-$10 deals worth it?",
    answer:
      "They're the lowest-risk buys on the site: cheap enough for impulse purchases, stocking stuffers, or bundling toward free-shipping minimums. Resellers also flip sub-$10 finds when the margin percentage is high enough.",
  },
  {
    question: "Why do prices this low exist?",
    answer:
      "Usually clearance, coupon stacking, subscribe-and-save stacking, or sellers liquidating overstock. Occasionally a pricing error creates an extreme under-$10 deal — those sell out fastest.",
  },
  {
    question: "How fresh is this list?",
    answer:
      "The page refreshes hourly. Sub-$10 items turn over quickly, so if the page looks sparse, check back — new cheap finds land throughout the day.",
  },
];

export default async function UnderTenPage() {
  let deals: ArbitrageDeal[] = [];
  let error = "";
  try {
    const data = await getPublicDeals(200, 0);
    deals = data
      .filter((d) => d.buy_price > 0 && d.buy_price < 10)
      .sort(
        (a, b) =>
          discountPercent(b) - discountPercent(a) ||
          a.buy_price - b.buy_price
      )
      .slice(0, 48);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load deals";
  }

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Deals Under $10",
    url: "https://www.bargainhuntrs.com/deals/under-10",
    description:
      "Live deals priced under $10 across major retailers, ranked by discount.",
  };

  return (
    <SeoPageLayout
      config={{
        title: "Deals Under $10",
        description:
          "Every live deal under ten dollars across Amazon, Walmart, Target, and hundreds of retailers — ranked by discount. Cheap thrills, zero guilt. Updated hourly.",
        source: "under_10",
        showRank: true,
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
        jsonLd: [faqJsonLd, itemListJsonLd],
        introContent: (
          <>
            <p>
              Welcome to the <strong>under-$10 bin</strong>. Everything here is currently
              priced below ten bucks — sorted by how far it dropped from its tracked
              average, so the biggest steals float to the top.
            </p>
            <p>
              Under-$10 deals are perfect for impulse buys, gift stockpiles, and
              free-shipping fillers. Prices this low don&apos;t last — grab them while
              they&apos;re live.
            </p>
          </>
        ),
      }}
      deals={deals}
      error={error}
    />
  );
}
