import type { Metadata } from "next";
import { getPublicDeals, type ArbitrageDeal } from "@/lib/api";
import { discountPercent, savingsAmount } from "@/lib/seo-helpers";
import SeoPageLayout from "@/components/SeoPageLayout";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Deals Over 50% Off — Half-Price & Better Bargains | BargainHuntrs",
  description:
    "Every live deal discounted 50% or more across Amazon, Walmart, Target, and hundreds of retailers. Deep discounts verified against tracked price history. Updated hourly.",
  alternates: { canonical: "/deals/over-50-off" },
  openGraph: {
    type: "website",
    siteName: "BargainHuntrs",
    title: "Deals Over 50% Off — Half-Price & Better Bargains | BargainHuntrs",
    description:
      "Every live deal discounted 50% or more across Amazon, Walmart, Target, and hundreds of retailers. Updated hourly.",
    url: "/deals/over-50-off",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Deals Over 50% Off" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: "Deals Over 50% Off — Half-Price & Better Bargains | BargainHuntrs",
    description:
      "Every live deal discounted 50% or more across Amazon, Walmart, Target, and more.",
    images: ["/og-image.png"],
  },
};

const RELATED_LINKS = [
  { href: "/deals/today", label: "Today's Best Deals" },
  { href: "/deals/price-drops", label: "Price Drops" },
  { href: "/deals/under-10", label: "Deals Under $10" },
  { href: "/deals/clearance", label: "Clearance Deals" },
  { href: "/deals/walmart-deals", label: "Walmart Deals" },
];

const FAQS = [
  {
    question: "Are these really 50% off or more?",
    answer:
      "Yes — every deal on this page is priced at least 50% below its tracked historical average. We compare against each product's own price history rather than a retailer's suggested 'list price', so the discount reflects a real drop.",
  },
  {
    question: "Why are discounts this deep?",
    answer:
      "Half-off-plus deals usually come from clearance events, discontinued items, overstock liquidations, coupon stacking, or occasional pricing errors. They tend to be the fastest-selling deals on the site.",
  },
  {
    question: "How often is this page updated?",
    answer:
      "The list refreshes hourly as our scanners detect new markdowns and retire expired ones. A deal that was 60% off this morning may be gone or back at full price by afternoon — check back often.",
  },
  {
    question: "Do I need an account to see 50%+ deals?",
    answer:
      "No — this page is free to browse. Creating a free account unlocks deal alerts so you're notified the moment a deep discount matching your interests is detected.",
  },
];

export default async function OverFiftyOffPage() {
  let deals: ArbitrageDeal[] = [];
  let error = "";
  try {
    const data = await getPublicDeals(200, 0);
    deals = data
      .filter((d) => discountPercent(d) >= 50)
      .sort(
        (a, b) =>
          discountPercent(b) - discountPercent(a) ||
          savingsAmount(b) - savingsAmount(a)
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
    name: "Deals Over 50% Off",
    url: "https://www.bargainhuntrs.com/deals/over-50-off",
    description:
      "Live deals discounted 50% or more versus tracked price history across major retailers.",
  };

  return (
    <SeoPageLayout
      config={{
        title: "Deals Over 50% Off",
        description:
          "Every live deal discounted 50% or more versus its tracked average — clearance, liquidation, and the occasional price glitch from Amazon, Walmart, Target, and hundreds more. Updated hourly.",
        source: "over_50_off",
        showRank: true,
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
        jsonLd: [faqJsonLd, itemListJsonLd],
        introContent: (
          <>
            <p>
              This is the deep-discount aisle: only items priced at least
              <strong> half off their tracked average</strong> make this page. Discounts are
              measured against each product&apos;s real price history, so a 50% badge here
              means a genuine markdown.
            </p>
            <p>
              Deep discounts are almost always limited — clearance stock, coupon stacks, or
              short-lived glitches. When something fits, move fast; when it&apos;s gone, the
              next hourly refresh will have new ones.
            </p>
          </>
        ),
      }}
      deals={deals}
      error={error}
    />
  );
}
