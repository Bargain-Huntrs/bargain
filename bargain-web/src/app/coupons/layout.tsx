import type { Metadata } from "next";

// Fallback metadata for the /coupons segment — the index page is a client
// component and can't export its own metadata; /coupons/[slug] overrides
// this via generateMetadata.
export const metadata: Metadata = {
  title: "Coupon Codes & Promo Codes — Verified Retailer Discounts",
  description:
    "Real promo codes from affiliate networks and deal feeds — crowd-tested by shoppers. Stack codes on top of deals for extra savings at Amazon, Walmart, Target, and more.",
  alternates: { canonical: "/coupons" },
  openGraph: {
    type: "website",
    siteName: "BargainHuntrs",
    title: "Coupon Codes & Promo Codes — Verified Retailer Discounts | BargainHuntrs",
    description:
      "Real promo codes from affiliate networks and deal feeds — crowd-tested by shoppers.",
    url: "/coupons",
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: "Coupon Codes & Promo Codes — Verified Retailer Discounts | BargainHuntrs",
    description:
      "Real promo codes from affiliate networks and deal feeds — crowd-tested by shoppers.",
  },
};

export default function CouponsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
