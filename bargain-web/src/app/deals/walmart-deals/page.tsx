import type { Metadata } from "next";
import { getPublicDeals, type ArbitrageDeal } from "@/lib/api";
import { discountPercent, savingsAmount } from "@/lib/seo-helpers";
import SeoPageLayout from "@/components/SeoPageLayout";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Walmart Deals & Clearance — Today's Best Walmart Bargains | BargainHuntrs",
  description:
    "Find today's best Walmart deals and clearance items. Save up to 70% at Walmart with our deal scanner. Updated automatically throughout the day.",
  alternates: { canonical: "/deals/walmart-deals" },
  openGraph: {
    type: "website",
    siteName: "BargainHuntrs",
    title: "Walmart Deals & Clearance — Today's Best Walmart Bargains | BargainHuntrs",
    description:
      "Find today's best Walmart deals and clearance items. Save up to 70% at Walmart. Updated automatically.",
    url: "/deals/walmart-deals",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Walmart Deals & Clearance" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: "Walmart Deals & Clearance — Today's Best Walmart Bargains | BargainHuntrs",
    description:
      "Find today's best Walmart deals and clearance items. Updated automatically.",
    images: ["/og-image.png"],
  },
};

const RELATED_LINKS = [
  { href: "/deals/today", label: "Today's Best Deals" },
  { href: "/deals/amazon-deals", label: "Amazon Deals" },
  { href: "/deals/clearance", label: "Clearance Deals" },
  { href: "/deals/under-10", label: "Deals Under $10" },
  { href: "/deals/over-50-off", label: "Over 50% Off" },
];

const FAQS = [
  {
    question: "How do I find Walmart clearance deals?",
    answer:
      "Our scanners continuously monitor Walmart.com for clearance items and price drops. This page automatically shows all Walmart deals and clearance items detected by our system. Check back throughout the day for new additions.",
  },
  {
    question: "Can I buy Walmart deals online?",
    answer:
      "Yes. Most Walmart deals shown here are available online at Walmart.com. Click any deal to go directly to the product page on Walmart's website. Some deals may also be available in-store depending on your location.",
  },
  {
    question: "How often are Walmart deals updated?",
    answer:
      "Our scanners run continuously, detecting new Walmart deals and clearance items as they appear. This page is refreshed automatically, so you always see the most current Walmart bargains available.",
  },
];

export default async function WalmartDealsPage() {
  let deals: ArbitrageDeal[] = [];
  let error = "";
  try {
    const data = await getPublicDeals(200, 0);
    deals = data
      .filter((d) => d.retailer && d.retailer.toLowerCase() === "walmart")
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
    name: "Walmart Deals and Clearance",
    url: "https://www.bargainhuntrs.com/deals/walmart-deals",
    description: "Today's best Walmart deals and clearance items.",
  };

  return (
    <SeoPageLayout
      config={{
        title: "Walmart Deals & Clearance",
        description:
          "Today's best Walmart deals and clearance items. Save up to 70% at Walmart with deals updated automatically throughout the day.",
        source: "walmart_deals",
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
        jsonLd: [faqJsonLd, itemListJsonLd],
        introContent: (
          <>
            <p>
              Find the best <strong>Walmart deals</strong> and <strong>Walmart clearance</strong>{" "}
              items all in one place. BargainHuntrs scans Walmart.com continuously to find the
              biggest discounts, steepest price drops, and hidden clearance bargains. This page
              is updated automatically as new deals are detected.
            </p>
          </>
        ),
        bottomContent: (
          <>
            <h2>Walmart Deals Shopping Tips</h2>
            <h3>Shop Walmart clearance online</h3>
            <p>
              Walmart's online clearance section is a goldmine for bargains. Many clearance
              items are only available online and not in stores. Our scanners catch these deals
              the moment they go live, so you can grab them before they sell out.
            </p>
            <h3>Check rollback prices</h3>
            <p>
              Walmart rollback deals are temporary price reductions on popular items. These are
              different from clearance items and typically last for a few weeks. Look for deals
              with significant discounts below the historical average price.
            </p>
            <h3>Compare with Amazon</h3>
            <p>
              Before buying, compare the Walmart deal price with the same product on Amazon.
              Our platform tracks both retailers, so you can see which one offers the better
              deal. Sometimes Walmart beats Amazon on price, especially for clearance items.
            </p>
            <h3>Watch for online-only deals</h3>
            <p>
              Many of the best Walmart deals are online-only and not available in physical
              stores. These deals can sell out quickly since they're available to shoppers
              nationwide. Act fast when you see a deal you want.
            </p>
          </>
        ),
      }}
      deals={deals}
      error={error}
    />
  );
}
