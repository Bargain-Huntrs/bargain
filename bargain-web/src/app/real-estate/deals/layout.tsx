import type { Metadata } from "next";

const TITLE = "Distressed Property Deals — HUD Homes, REO & Off-Market Listings | BargainHuntrs";
const DESCRIPTION =
  "Browse live distressed-property listings from public sources — HUD Home Store REO inventory and more. Filter by state, price, and beds, then run every deal through the free bargain calculator.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "distressed properties for sale",
    "HUD homes",
    "REO listings",
    "bank owned homes",
    "off market real estate deals",
    "foreclosure listings",
    "investment property deals",
    "fix and flip deals",
  ],
  alternates: { canonical: "/real-estate/deals" },
  openGraph: {
    type: "website",
    siteName: "BargainHuntrs",
    title: TITLE,
    description: DESCRIPTION,
    url: "/real-estate/deals",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Distressed Property Deals" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export default function RealEstateDealsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
