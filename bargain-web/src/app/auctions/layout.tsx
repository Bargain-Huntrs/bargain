import type { Metadata } from "next";

// Fallback metadata for /auctions — the page is a client component and can't
// export its own metadata.
export const metadata: Metadata = {
  title: "Live Auctions — Government Surplus & Liquidation Deals",
  description:
    "Browse live government surplus and liquidation auctions — electronics, tools, equipment and more. Track bids and find underpriced lots to flip.",
  alternates: { canonical: "/auctions" },
  openGraph: {
    type: "website",
    title: "Live Auctions — Government Surplus & Liquidation Deals | BargainHuntrs",
    description:
      "Browse live government surplus and liquidation auctions — track bids and find underpriced lots.",
    url: "/auctions",
  },
};

export default function AuctionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
