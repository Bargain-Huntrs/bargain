import type { Metadata } from "next";

// Fallback metadata for /community/leaderboard — the page is a client
// component and can't export its own metadata.
export const metadata: Metadata = {
  title: "Community Leaderboard — Top Deal Hunters",
  description:
    "See the top deal hunters on BargainHuntrs — community members ranked by deals found, upvotes, and Aura points.",
  alternates: { canonical: "/community/leaderboard" },
  openGraph: {
    type: "website",
    title: "Community Leaderboard — Top Deal Hunters | BargainHuntrs",
    description:
      "See the top deal hunters on BargainHuntrs — ranked by deals found, upvotes, and Aura points.",
    url: "/community/leaderboard",
  },
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
