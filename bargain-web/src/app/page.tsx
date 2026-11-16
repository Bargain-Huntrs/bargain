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

// Organization + WebSite entity JSON-LD lives in layout.tsx so it renders
// sitewide; only the homepage-specific ItemList stays here.
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
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(dealsJsonLd) }}
      />
      <HomePageContent />
    </>
  );
}
// Auto-deploy test: Sun Aug 30 17:11:31 PDT 2026
