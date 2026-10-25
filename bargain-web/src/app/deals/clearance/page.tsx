import type { Metadata } from "next";
import { getPublicDeals, type ArbitrageDeal } from "@/lib/api";
import { discountPercent, savingsAmount } from "@/lib/seo-helpers";
import SeoPageLayout from "@/components/SeoPageLayout";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Clearance Deals — Best Clearance Sales Online | BargainHuntrs",
  description:
    "Find the best clearance deals and clearance sales from Amazon, Walmart, Target, and more. Save up to 80% on clearance items. Updated daily.",
  alternates: { canonical: "/deals/clearance" },
  openGraph: {
    type: "website",
    siteName: "BargainHuntrs",
    title: "Clearance Deals — Best Clearance Sales Online | BargainHuntrs",
    description:
      "Find the best clearance deals and clearance sales from Amazon, Walmart, Target, and more. Save up to 80% on clearance items.",
    url: "/deals/clearance",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Clearance Deals" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: "Clearance Deals — Best Clearance Sales Online | BargainHuntrs",
    description:
      "Find the best clearance deals and clearance sales. Save up to 80% on clearance items.",
    images: ["/og-image.png"],
  },
};

const RELATED_LINKS = [
  { href: "/deals/today", label: "Today's Best Deals" },
  { href: "/deals/walmart-deals", label: "Walmart Deals" },
  { href: "/guides/how-to-find-price-glitches", label: "Price Glitch Guide" },
  { href: "/deals/over-50-off", label: "Over 50% Off" },
  { href: "/deals/under-10", label: "Deals Under $10" },
];

const FAQS = [
  {
    question: "What are clearance deals?",
    answer:
      "Clearance deals are items that retailers are discontinuing or clearing out of inventory. They are typically priced well below retail to sell quickly. Clearance deals offer some of the deepest discounts available but have limited stock and are often final sale.",
  },
  {
    question: "How do I find clearance sales online?",
    answer:
      "Our scanners automatically detect clearance items across major retailers like Amazon, Walmart, Target, and more. This page shows all clearance deals detected by our system, sorted by discount percentage. Check back throughout the day for new additions.",
  },
  {
    question: "Are clearance deals final sale?",
    answer:
      "In many cases, clearance items are final sale and cannot be returned. Always check the retailer's return policy before purchasing. However, some retailers do allow returns on clearance items within their standard return window.",
  },
  {
    question: "How much can I save on clearance deals?",
    answer:
      "Clearance deals typically offer savings of 50% to 80% off the original retail price. Some clearance items are discounted even further, especially when retailers are trying to clear out seasonal inventory or discontinued products.",
  },
];

export default async function ClearanceDealsPage() {
  let deals: ArbitrageDeal[] = [];
  let error = "";
  try {
    const data = await getPublicDeals(200, 0);
    deals = data
      .filter(
        (d) =>
          d.deal_tier === "clearance" ||
          d.deal_tier === "glitch" ||
          discountPercent(d) >= 40
      )
      .sort((a, b) => discountPercent(b) - discountPercent(a) || savingsAmount(b) - savingsAmount(a))
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
    name: "Clearance Deals",
    url: "https://www.bargainhuntrs.com/deals/clearance",
    description: "Best clearance deals and clearance sales from major retailers.",
  };

  return (
    <SeoPageLayout
      config={{
        title: "Clearance Deals",
        description:
          "The best clearance deals and clearance sales from Amazon, Walmart, Target, and more. Save up to 80% on clearance items. Updated daily.",
        source: "clearance_deals",
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
        jsonLd: [faqJsonLd, itemListJsonLd],
        introContent: (
          <>
            <p>
              Welcome to our <strong>clearance deals</strong> page. BargainHuntrs scans major
              retailers continuously to find the deepest clearance sales and biggest markdowns.
              From Amazon clearance to Walmart clearance, we surface the best deals the moment
              they go live.
            </p>
            <p>
              Clearance items are typically discontinued or seasonal products being sold at a
              fraction of their original price. Stock is limited and these deals can sell out
              fast, so act quickly on anything that interests you.
            </p>
          </>
        ),
      }}
      deals={deals}
      error={error}
    />
  );
}
