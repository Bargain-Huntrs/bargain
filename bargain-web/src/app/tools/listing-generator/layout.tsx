import type { Metadata } from "next";

const TITLE =
  "SI Listing Generator — Create eBay, Facebook Marketplace Listings | BargainHuntrs";
const DESCRIPTION =
  "Generate optimized resale listings for eBay, Facebook Marketplace, Mercari, and more. Free SI-powered listing generator with SEO titles, descriptions, and pricing suggestions.";
const URL = "https://www.bargainhuntrs.com/tools/listing-generator";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "listing generator",
    "ebay listing generator",
    "resale listing generator",
    "facebook marketplace listing generator",
    "mercari listing generator",
    "poshmark listing generator",
    "depop listing generator",
    "ai listing generator",
    "listing description generator",
    "seo listing title generator",
  ],
  alternates: { canonical: "/tools/listing-generator" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: "BargainHuntrs",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function ListingGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
