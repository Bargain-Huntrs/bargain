import type { Metadata } from "next";

// Fallback metadata for the /deals segment — the index page is a client
// component and can't export its own metadata; sibling pages that define
// metadata or generateMetadata override this.
export const metadata: Metadata = {
  title: "Live Deal Feed — Arbitrage Deals Updated Continuously",
  description:
    "Browse live arbitrage deals, price glitches, and clearance finds scraped from 500+ retailers. Sorted by profit — sign up free to unlock full prices and instant alerts.",
  alternates: { canonical: "/deals" },
  openGraph: {
    type: "website",
    siteName: "BargainHuntrs",
    title: "Live Deal Feed — Arbitrage Deals Updated Continuously | BargainHuntrs",
    description:
      "Browse live arbitrage deals, price glitches, and clearance finds scraped from 500+ retailers.",
    url: "/deals",
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: "Live Deal Feed — Arbitrage Deals Updated Continuously | BargainHuntrs",
    description:
      "Browse live arbitrage deals, price glitches, and clearance finds scraped from 500+ retailers.",
  },
};

export default function DealsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
