import type { Metadata } from "next";
import { getPublicDeals, type ArbitrageDeal } from "@/lib/api";
import { discountPercent, savingsAmount } from "@/lib/seo-helpers";
import SeoPageLayout from "@/components/SeoPageLayout";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Price Drops Today — Biggest Markdowns Across Top Retailers | BargainHuntrs",
  description:
    "The biggest price drops detected today across Amazon, Walmart, Target, Best Buy, and more. Fresh markdowns ranked by discount percentage. Updated hourly.",
  alternates: { canonical: "/deals/price-drops" },
  openGraph: {
    type: "website",
    siteName: "BargainHuntrs",
    title: "Price Drops Today — Biggest Markdowns Across Top Retailers | BargainHuntrs",
    description:
      "The biggest price drops detected today across Amazon, Walmart, Target, Best Buy, and more. Updated hourly.",
    url: "/deals/price-drops",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Price Drops Today" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: "Price Drops Today — Biggest Markdowns Across Top Retailers | BargainHuntrs",
    description:
      "The biggest price drops detected today across Amazon, Walmart, Target, and more.",
    images: ["/og-image.png"],
  },
};

const RELATED_LINKS = [
  { href: "/deals/today", label: "Today's Best Deals" },
  { href: "/deals/over-50-off", label: "Over 50% Off" },
  { href: "/deals/under-10", label: "Deals Under $10" },
  { href: "/deals/clearance", label: "Clearance Deals" },
  { href: "/deals/amazon-deals", label: "Amazon Deals" },
];

const FAQS = [
  {
    question: "What is a price drop?",
    answer:
      "A price drop is when a retailer lowers the price of a product below its recent average. Our scanners track prices continuously and surface items the moment they fall below their historical average, so you see the markdown while it's still live.",
  },
  {
    question: "How are these price drops ranked?",
    answer:
      "Deals on this page are ranked by discount percentage versus each product's historical average price, with bigger dollar savings breaking ties. That means the steepest real markdowns surface first — not inflated 'was' prices.",
  },
  {
    question: "Do price drops last long?",
    answer:
      "Usually not. Large markdowns can revert within hours, and popular items sell out at the lower price. If a deal looks good, it's worth grabbing quickly — and checking back throughout the day for new drops.",
  },
  {
    question: "Are these prices verified?",
    answer:
      "Each drop is detected by comparing the current listed price to that product's own tracked history. Prices can still change between our last scan and your visit, so always confirm the final price on the retailer's page.",
  },
];

export default async function PriceDropsPage() {
  let deals: ArbitrageDeal[] = [];
  let error = "";
  try {
    const data = await getPublicDeals(200, 0);
    deals = data
      .filter((d) => discountPercent(d) >= 15)
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
    name: "Price Drops Today",
    url: "https://www.bargainhuntrs.com/deals/price-drops",
    description:
      "The biggest price drops detected today across major retailers, ranked by discount percentage.",
  };

  return (
    <SeoPageLayout
      config={{
        title: "Price Drops Today",
        description:
          "The biggest price drops detected today across Amazon, Walmart, Target, Best Buy, and more — ranked by real discount versus each product's tracked average. Updated hourly.",
        source: "price_drops",
        showRank: true,
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
        jsonLd: [faqJsonLd, itemListJsonLd],
        introContent: (
          <>
            <p>
              Welcome to <strong>Price Drops Today</strong>. BargainHuntrs tracks product
              prices across hundreds of retailers and flags every item that falls below
              its own historical average — so every deal here is a genuine markdown,
              not a manufactured &quot;was&quot; price.
            </p>
            <p>
              Big drops move fast: prices revert and stock runs out. Each card shows the
              discount percentage, current price, and retailer so you can jump on the
              steepest markdowns first.
            </p>
          </>
        ),
      }}
      deals={deals}
      error={error}
    />
  );
}
