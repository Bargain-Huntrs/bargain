import type { Metadata } from "next";

// Fallback metadata for /seller — the page is a client component and can't
// export its own metadata.
export const metadata: Metadata = {
  title: "Seller Portal — Submit Deals, Coupons & Price Drops",
  description:
    "Retailers and sellers: submit your deals, coupon codes, and price drops to BargainHuntrs and reach deal-hunting shoppers.",
  alternates: { canonical: "/seller" },
  openGraph: {
    type: "website",
    title: "Seller Portal — Submit Deals, Coupons & Price Drops | BargainHuntrs",
    description:
      "Submit your deals, coupon codes, and price drops to reach deal-hunting shoppers.",
    url: "/seller",
  },
};

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
