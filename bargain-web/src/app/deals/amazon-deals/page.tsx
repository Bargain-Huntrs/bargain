import type { Metadata } from "next";
import { getPublicDeals, type ArbitrageDeal } from "@/lib/api";
import { discountPercent, savingsAmount } from "@/lib/seo-helpers";
import SeoPageLayout from "@/components/SeoPageLayout";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Amazon Deals Today — Best Amazon Bargains & Discounts | BargainHuntrs",
  description:
    "Find today's best Amazon deals, discounts, and clearance items. Updated automatically throughout the day. Save up to 70% on Amazon with our deal scanner.",
  alternates: { canonical: "/deals/amazon-deals" },
  openGraph: {
    type: "website",
    siteName: "BargainHuntrs",
    title: "Amazon Deals Today — Best Amazon Bargains & Discounts | BargainHuntrs",
    description:
      "Find today's best Amazon deals, discounts, and clearance items. Updated automatically throughout the day.",
    url: "/deals/amazon-deals",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Amazon Deals Today" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: "Amazon Deals Today — Best Amazon Bargains & Discounts | BargainHuntrs",
    description:
      "Find today's best Amazon deals, discounts, and clearance items. Updated automatically.",
    images: ["/og-image.png"],
  },
};

const RELATED_LINKS = [
  { href: "/deals/today", label: "Today's Best Deals" },
  { href: "/deals/price-drops", label: "Price Drops" },
  { href: "/deals/over-50-off", label: "Over 50% Off" },
  { href: "/deals/under-10", label: "Deals Under $10" },
  { href: "/guides/how-to-find-price-glitches", label: "Price Glitch Guide" },
  { href: "/guides/best-times-to-find-deals", label: "Best Times to Find Deals" },
];

const FAQS = [
  {
    question: "How do I find the best Amazon deals today?",
    answer:
      "Our scanners continuously monitor Amazon for price drops, clearance items, and pricing errors. This page automatically shows the best Amazon deals available right now, sorted by discount percentage. Bookmark this page and check back throughout the day for fresh deals.",
  },
  {
    question: "Are Amazon deals time-limited?",
    answer:
      "Yes. Amazon deals can expire at any time. Lightning Deals last only a few hours, while price drops and clearance items can sell out quickly. We recommend checking this page multiple times per day and acting fast on deals you want.",
  },
  {
    question: "What is an Amazon price glitch?",
    answer:
      "A price glitch is when Amazon's pricing system makes an error, resulting in an unusually low price. These are rare and typically corrected within minutes or hours. Our scanners detect these glitches in real time so you can take advantage before they're fixed.",
  },
];

export default async function AmazonDealsLandingPage() {
  let deals: ArbitrageDeal[] = [];
  let error = "";
  try {
    const data = await getPublicDeals(200, 0);
    deals = data
      .filter((d) => !d.retailer || d.retailer.toLowerCase() === "amazon")
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
    name: "Amazon Deals Today",
    url: "https://www.bargainhuntrs.com/deals/amazon-deals",
    description: "Today's best Amazon deals, discounts, and clearance items.",
  };

  return (
    <SeoPageLayout
      config={{
        title: "Amazon Deals Today",
        description:
          "Today's best Amazon deals, discounts, and clearance items. Updated automatically throughout the day as our scanners find new opportunities.",
        source: "amazon_deals_landing",
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
        jsonLd: [faqJsonLd, itemListJsonLd],
        introContent: (
          <>
            <p>
              Welcome to the ultimate destination for <strong>Amazon deals today</strong>.
              BargainHuntrs scans Amazon around the clock to find the biggest discounts,
              steepest price drops, and rare pricing glitches. This page is updated
              automatically as new deals are detected.
            </p>
          </>
        ),
        bottomContent: (
          <>
            <h2>Amazon Deals Buying Guide</h2>
            <p>
              Shopping Amazon deals can be overwhelming with thousands of discounts available
              at any given time. Here's how to make the most of this page and find the best
              Amazon bargains.
            </p>
            <h3>Check the discount percentage</h3>
            <p>
              Each deal card shows the discount percentage based on the historical average
              price. Deals with higher percentages offer the best value, but always check the
              actual product to make sure it's something you need.
            </p>
            <h3>Act fast on price glitches</h3>
            <p>
              Items labeled "PRICE ERROR" are Amazon pricing glitches. These are rare
              opportunities where Amazon's system has incorrectly priced an item. They are
              typically corrected within minutes, so if you see one, add it to your cart and
              checkout immediately.
            </p>
            <h3>Compare with the historical average</h3>
            <p>
              The strikethrough price on each deal card shows the historical average price.
              This helps you understand whether the current deal is genuinely a good price or
              just a temporary promotion. Deals that are significantly below the historical
              average are the best opportunities.
            </p>
            <h3>Watch for clearance items</h3>
            <p>
              Amazon clearance deals are items being discontinued or cleared out. These often
              offer the deepest discounts but have limited stock. Once they're gone, they're
              gone for good.
            </p>
            <h3>Sign up for alerts</h3>
            <p>
              Don't want to check this page all day? Sign up for a free BargainHuntrs account
              to get instant alerts when new Amazon deals are detected. Upgrade to our Hunter
              plan for real-time push notifications on price glitches.
            </p>
          </>
        ),
      }}
      deals={deals}
      error={error}
    />
  );
}
