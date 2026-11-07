import type { Metadata } from "next";
import HomePageContent from "@/app/HomePageContent";
import { stringifyJsonLd } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "BargainHuntrs — Find It, Flip It, Profit | Deal Discovery & Arbitrage",
  description:
    "Discover the best deals, discounts, clearance items, and arbitrage opportunities. Track prices, get alerts, and maximize your profits.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "BargainHuntrs — Find It, Flip It, Profit | Deal Discovery & Arbitrage",
    description:
      "Discover the best deals, discounts, clearance items, and arbitrage opportunities. Track prices, get alerts, and maximize your profits.",
    url: "/",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BargainHuntrs — Find It, Flip It, Profit",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BargainHuntrs — Find It, Flip It, Profit | Deal Discovery & Arbitrage",
    description:
      "Discover the best deals, discounts, clearance items, and arbitrage opportunities. Track prices, get alerts, and maximize your profits.",
    images: ["/og-image.png"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "BargainHuntrs",
  url: "https://www.bargainhuntrs.com",
  logo: "https://www.bargainhuntrs.com/og-image.png",
  description:
    "Discover the best deals, discounts, clearance items, and arbitrage opportunities from Amazon, Walmart, and more.",
  sameAs: [
    "https://twitter.com/bargain4huntrs",
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "BargainHuntrs",
  url: "https://www.bargainhuntrs.com",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      // /deals reads the ?q= param into its search box — a real search page.
      urlTemplate:
        "https://www.bargainhuntrs.com/deals?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};

const dealsJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Today's Top Deals",
  url: "https://www.bargainhuntrs.com",
  description:
    "Live arbitrage deals and price errors from major retailers, updated throughout the day.",
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(dealsJsonLd) }}
      />
      <HomePageContent />
    </>
  );
}
// Auto-deploy test: Sun Aug 30 17:11:31 PDT 2026
