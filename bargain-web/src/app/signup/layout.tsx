import type { Metadata } from "next";

// Fallback metadata for /signup — the page is a client component and can't
// export its own metadata.
export const metadata: Metadata = {
  title: "Sign Up Free — Deal Alerts & Arbitrage Tools",
  description:
    "Create a free BargainHuntrs account — live deal feed, price alerts, watchlists, and arbitrage tools. Upgrade anytime for full prices and instant alerts.",
  alternates: { canonical: "/signup" },
  openGraph: {
    type: "website",
    title: "Sign Up Free — Deal Alerts & Arbitrage Tools | BargainHuntrs",
    description:
      "Create a free BargainHuntrs account — live deal feed, price alerts, watchlists, and arbitrage tools.",
    url: "/signup",
  },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
