import type { Metadata } from "next";
import CategoriesClient from "./CategoriesClient";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Deal Categories — Retail, Real Estate, Auctions & More | BargainHuntrs",
  description:
    "Browse every deal category on BargainHuntrs: retail price glitches, clearance, real estate, government auctions, coupons, and community finds.",
  alternates: { canonical: "/categories" },
  openGraph: {
    type: "website",
    siteName: "BargainHuntrs",
    title: "Deal Categories — Retail, Real Estate, Auctions & More | BargainHuntrs",
    description:
      "Browse every deal category on BargainHuntrs: retail price glitches, clearance, real estate, government auctions, coupons, and community finds.",
    url: "/categories",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BargainHuntrs deal categories",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
  },
};

export default function CategoriesPage() {
  return <CategoriesClient />;
}
