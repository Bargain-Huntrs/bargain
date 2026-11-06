import type { Metadata } from "next";

// Fallback metadata for /referrals — the page is a client component and can't
// export its own metadata.
export const metadata: Metadata = {
  title: "Refer Friends — Earn Aura Points",
  description:
    "Invite friends to BargainHuntrs — earn 100 Aura points per signup, they get 50. Climb the referrer leaderboard.",
  alternates: { canonical: "/referrals" },
  openGraph: {
    type: "website",
    title: "Refer Friends — Earn Aura Points | BargainHuntrs",
    description:
      "Invite friends to BargainHuntrs — earn 100 Aura points per signup, they get 50.",
    url: "/referrals",
  },
};

export default function ReferralsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
